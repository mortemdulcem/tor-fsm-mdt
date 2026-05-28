"""
TIER C experiments: ML baseline comparison and visualization.
C1: Isolation Forest anomaly detector on event sequences
C2: Confusion matrix figures
C3: ROC curves

All data from existing v1+v2 event logs. No new Shadow runs.
No fabricated data.
"""

import json
import os
import glob
import numpy as np
from collections import defaultdict
from pathlib import Path

# Paths
EXPERIMENTS_DIR = Path(__file__).parent
V1_DIR = EXPERIMENTS_DIR / "shadow_runs_v1"
V2_DIR = EXPERIMENTS_DIR / "shadow_runs_v2"

# FSM definition (mirroring server/fsm.ts)
STATES = [
    "IDLE", "CONNECTING", "TLS_HANDSHAKE", "CREATE_SENT",
    "CIRCUIT_BUILDING", "CIRCUIT_READY", "TRANSMITTING",
    "CLOSING", "CLOSED", "ERROR"
]
EVENTS = [
    "CONNECT", "TLS_OK", "TLS_FAIL", "SEND_CREATE", "RECV_CREATED",
    "SEND_EXTEND", "RECV_EXTENDED", "SEND_RELAY_DATA", "RECV_RELAY_DATA",
    "SEND_DESTROY", "RECV_DESTROY", "CIRCUIT_CLOSED", "TIMEOUT"
]

STATE_IDX = {s: i for i, s in enumerate(STATES)}
EVENT_IDX = {e: i for i, e in enumerate(EVENTS)}

# 3-hop valid transitions
VALID_3HOP = {}
transitions = [
    ("IDLE", "CONNECT", "CONNECTING"),
    ("CONNECTING", "TLS_OK", "TLS_HANDSHAKE"),
    ("CONNECTING", "TLS_FAIL", "ERROR"),
    ("CONNECTING", "TIMEOUT", "ERROR"),
    ("TLS_HANDSHAKE", "SEND_CREATE", "CREATE_SENT"),
    ("TLS_HANDSHAKE", "TLS_FAIL", "ERROR"),
    ("TLS_HANDSHAKE", "TIMEOUT", "ERROR"),
    ("CREATE_SENT", "RECV_CREATED", "CIRCUIT_BUILDING"),
    ("CREATE_SENT", "TIMEOUT", "ERROR"),
    ("CIRCUIT_BUILDING", "SEND_EXTEND", "CIRCUIT_BUILDING"),
    ("CIRCUIT_BUILDING", "RECV_EXTENDED", "CIRCUIT_READY"),
    ("CIRCUIT_BUILDING", "TIMEOUT", "ERROR"),
    ("CIRCUIT_READY", "SEND_RELAY_DATA", "TRANSMITTING"),
    ("CIRCUIT_READY", "RECV_RELAY_DATA", "TRANSMITTING"),
    ("CIRCUIT_READY", "SEND_DESTROY", "CLOSING"),
    ("CIRCUIT_READY", "RECV_DESTROY", "CLOSING"),
    ("CIRCUIT_READY", "TIMEOUT", "ERROR"),
    ("CIRCUIT_READY", "SEND_EXTEND", "CIRCUIT_BUILDING"),
    ("CIRCUIT_READY", "RECV_EXTENDED", "CIRCUIT_READY"),
    ("TRANSMITTING", "SEND_RELAY_DATA", "TRANSMITTING"),
    ("TRANSMITTING", "RECV_RELAY_DATA", "TRANSMITTING"),
    ("TRANSMITTING", "SEND_DESTROY", "CLOSING"),
    ("TRANSMITTING", "RECV_DESTROY", "CLOSING"),
    ("TRANSMITTING", "TIMEOUT", "ERROR"),
    ("CLOSING", "CIRCUIT_CLOSED", "CLOSED"),
    ("CLOSING", "TIMEOUT", "CLOSED"),
    ("ERROR", "CIRCUIT_CLOSED", "CLOSED"),
]
for s, e, ns in transitions:
    VALID_3HOP[f"{s}|{e}"] = ns


def load_event_logs(base_dir):
    """Load all events.jsonl files from a shadow_runs directory."""
    results = []
    if not base_dir.exists():
        return results
    for scenario_dir in sorted(base_dir.iterdir()):
        if not scenario_dir.is_dir():
            continue
        scenario = scenario_dir.name
        for seed_dir in sorted(scenario_dir.iterdir()):
            if not seed_dir.is_dir():
                continue
            events_file = seed_dir / "events.jsonl"
            if not events_file.exists():
                continue
            events = []
            with open(events_file) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        events.append(json.loads(line))
            results.append({
                "scenario": scenario,
                "seed": seed_dir.name,
                "events": events,
                "file": str(events_file)
            })
    return results


def extract_circuit_features(events):
    """Extract feature vectors from circuit event sequences.

    Features per circuit:
    - Event count histogram (13 features, one per event type)
    - State visit counts (10 features, one per state)
    - Number of violations (FSM invalid transitions)
    - Sequence length
    - Ratio of valid to total transitions
    """
    circuits = defaultdict(list)
    for ev in events:
        circuits[ev["circuitId"]].append(ev)

    features = []
    labels = []
    circuit_ids = []

    for cid, cevents in circuits.items():
        # Event histogram
        event_hist = np.zeros(len(EVENTS))
        for ev in cevents:
            if ev["event"] in EVENT_IDX:
                event_hist[EVENT_IDX[ev["event"]]] += 1

        # State visit counts and violation count
        state_visits = np.zeros(len(STATES))
        violations = 0
        valid_count = 0
        state = "IDLE"
        state_visits[STATE_IDX[state]] += 1

        for ev in cevents:
            key = f"{state}|{ev['event']}"
            if key in VALID_3HOP:
                state = VALID_3HOP[key]
                valid_count += 1
            else:
                violations += 1
            state_visits[STATE_IDX[state]] += 1

        seq_len = len(cevents)
        valid_ratio = valid_count / max(seq_len, 1)

        feat = np.concatenate([
            event_hist,
            state_visits,
            [violations, seq_len, valid_ratio]
        ])
        features.append(feat)
        circuit_ids.append(cid)

    return np.array(features), circuit_ids


def main():
    print("=== TIER C: ML Baseline & Visualization ===\n")

    # Load all event logs
    v1_logs = load_event_logs(V1_DIR)
    v2_logs = load_event_logs(V2_DIR)
    all_logs = v1_logs + v2_logs

    print(f"Loaded {len(v1_logs)} v1 logs + {len(v2_logs)} v2 logs = {len(all_logs)} total")

    # Extract features from all circuits
    all_features = []
    all_labels = []
    all_scenarios = []
    all_cids = []

    for log in all_logs:
        features, cids = extract_circuit_features(log["events"])
        is_attack = log["scenario"] != "benign"

        for i, cid in enumerate(cids):
            all_features.append(features[i])
            all_labels.append(1 if is_attack else 0)
            all_scenarios.append(log["scenario"])
            all_cids.append(cid)

    X = np.array(all_features)
    y = np.array(all_labels)
    scenarios = np.array(all_scenarios)

    print(f"Total circuits: {len(X)}")
    print(f"  Benign: {np.sum(y == 0)}, Attack: {np.sum(y == 1)}")
    print(f"  Scenarios: {dict(zip(*np.unique(scenarios, return_counts=True)))}")

    # ============================================================
    # C1: Isolation Forest
    # ============================================================
    print("\n[C1] Isolation Forest anomaly detection...")

    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import (
        precision_score, recall_score, f1_score,
        roc_auc_score, confusion_matrix, classification_report
    )
    from sklearn.model_selection import StratifiedKFold
    from sklearn.preprocessing import StandardScaler

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train Isolation Forest (unsupervised — trained on all data,
    # contamination estimated from attack ratio)
    contamination = np.mean(y) if np.mean(y) > 0 else 0.1
    contamination = min(contamination, 0.5)

    clf = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_scaled)

    # Predict: -1 = anomaly (attack), 1 = normal (benign)
    y_pred_if = clf.predict(X_scaled)
    y_pred_binary = (y_pred_if == -1).astype(int)

    # Anomaly scores (for ROC)
    scores_if = -clf.decision_function(X_scaled)  # higher = more anomalous

    # Metrics
    if_precision = precision_score(y, y_pred_binary, zero_division=0)
    if_recall = recall_score(y, y_pred_binary, zero_division=0)
    if_f1 = f1_score(y, y_pred_binary, zero_division=0)
    if_auc = roc_auc_score(y, scores_if) if len(np.unique(y)) > 1 else 0.0
    if_cm = confusion_matrix(y, y_pred_binary)

    print(f"  Isolation Forest (full dataset):")
    print(f"    Precision: {if_precision:.4f}")
    print(f"    Recall:    {if_recall:.4f}")
    print(f"    F1:        {if_f1:.4f}")
    print(f"    AUC:       {if_auc:.4f}")
    print(f"    Confusion matrix:\n{if_cm}")

    # FSM baseline comparison (3-hop)
    # FSM prediction: circuit has violation => attack
    fsm_pred = np.zeros(len(X))
    for i, feat in enumerate(all_features):
        violations = feat[-3]  # violations is 3rd from last
        fsm_pred[i] = 1 if violations > 0 else 0

    fsm_precision = precision_score(y, fsm_pred, zero_division=0)
    fsm_recall = recall_score(y, fsm_pred, zero_division=0)
    fsm_f1 = f1_score(y, fsm_pred, zero_division=0)
    fsm_cm = confusion_matrix(y, fsm_pred)

    # FSM scores for ROC (violation count as score)
    fsm_scores = np.array([feat[-3] for feat in all_features])
    fsm_auc = roc_auc_score(y, fsm_scores) if len(np.unique(y)) > 1 and len(np.unique(fsm_scores)) > 1 else 0.0

    print(f"\n  FSM 3-hop baseline:")
    print(f"    Precision: {fsm_precision:.4f}")
    print(f"    Recall:    {fsm_recall:.4f}")
    print(f"    F1:        {fsm_f1:.4f}")
    print(f"    AUC:       {fsm_auc:.4f}")
    print(f"    Confusion matrix:\n{fsm_cm}")

    # 5-fold CV for Isolation Forest
    print("\n  5-fold CV for Isolation Forest...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_metrics = {"precision": [], "recall": [], "f1": [], "auc": []}

    for fold, (train_idx, test_idx) in enumerate(skf.split(X_scaled, y)):
        X_train, X_test = X_scaled[train_idx], X_scaled[test_idx]
        y_test = y[test_idx]

        clf_cv = IsolationForest(
            n_estimators=200,
            contamination=contamination,
            random_state=42
        )
        clf_cv.fit(X_train)
        y_cv_pred = (clf_cv.predict(X_test) == -1).astype(int)
        scores_cv = -clf_cv.decision_function(X_test)

        cv_metrics["precision"].append(precision_score(y_test, y_cv_pred, zero_division=0))
        cv_metrics["recall"].append(recall_score(y_test, y_cv_pred, zero_division=0))
        cv_metrics["f1"].append(f1_score(y_test, y_cv_pred, zero_division=0))
        if len(np.unique(y_test)) > 1:
            cv_metrics["auc"].append(roc_auc_score(y_test, scores_cv))

    for m in cv_metrics:
        vals = cv_metrics[m]
        if vals:
            print(f"    {m}: {np.mean(vals):.4f} +/- {np.std(vals):.4f}")

    # ============================================================
    # C2: Confusion Matrix Figures
    # ============================================================
    print("\n[C2] Generating confusion matrix figures...")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig_dir = EXPERIMENTS_DIR / "figures"
    fig_dir.mkdir(exist_ok=True)

    def plot_confusion_matrix(cm, title, filename, labels=["Benign", "Attack"]):
        fig, ax = plt.subplots(figsize=(5, 4))
        im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        ax.figure.colorbar(im, ax=ax)
        ax.set(
            xticks=np.arange(cm.shape[1]),
            yticks=np.arange(cm.shape[0]),
            xticklabels=labels,
            yticklabels=labels,
            title=title,
            ylabel="Gercek (True)",
            xlabel="Tahmin (Predicted)"
        )
        plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
        thresh = cm.max() / 2.0
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(j, i, format(cm[i, j], "d"),
                        ha="center", va="center",
                        color="white" if cm[i, j] > thresh else "black")
        fig.tight_layout()
        fig.savefig(str(fig_dir / filename), dpi=150, bbox_inches="tight")
        plt.close(fig)
        print(f"    Saved: {fig_dir / filename}")

    # FSM confusion matrix
    plot_confusion_matrix(fsm_cm, "FSM 3-hop Monitor", "cm_fsm_3hop.png")

    # Isolation Forest confusion matrix
    plot_confusion_matrix(if_cm, "Isolation Forest", "cm_isolation_forest.png")

    # Per-scenario confusion matrices for FSM
    unique_scenarios = sorted(set(scenarios))
    for sc in unique_scenarios:
        if sc == "benign":
            continue
        mask = (scenarios == sc) | (scenarios == "benign")
        y_sc = y[mask]
        fsm_sc = fsm_pred[mask]
        if len(np.unique(y_sc)) < 2:
            continue
        cm_sc = confusion_matrix(y_sc, fsm_sc)
        plot_confusion_matrix(
            cm_sc,
            f"FSM 3-hop: {sc}",
            f"cm_fsm_{sc}.png"
        )

    # ============================================================
    # C3: ROC Curves
    # ============================================================
    print("\n[C3] Generating ROC curves...")

    from sklearn.metrics import roc_curve, auc

    fig, ax = plt.subplots(figsize=(6, 5))

    # FSM ROC
    if len(np.unique(y)) > 1 and len(np.unique(fsm_scores)) > 1:
        fpr_fsm, tpr_fsm, _ = roc_curve(y, fsm_scores)
        auc_fsm = auc(fpr_fsm, tpr_fsm)
        ax.plot(fpr_fsm, tpr_fsm, "b-", linewidth=2,
                label=f"FSM 3-hop (AUC={auc_fsm:.3f})")

    # Isolation Forest ROC
    if len(np.unique(y)) > 1:
        fpr_if, tpr_if, _ = roc_curve(y, scores_if)
        auc_if = auc(fpr_if, tpr_if)
        ax.plot(fpr_if, tpr_if, "r--", linewidth=2,
                label=f"Isolation Forest (AUC={auc_if:.3f})")

    ax.plot([0, 1], [0, 1], "k:", linewidth=1, label="Rastgele")
    ax.set_xlabel("False Positive Rate (FPR)")
    ax.set_ylabel("True Positive Rate (TPR)")
    ax.set_title("ROC Egrisi: FSM vs Isolation Forest")
    ax.legend(loc="lower right")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(str(fig_dir / "roc_comparison.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {fig_dir / 'roc_comparison.png'}")

    # ============================================================
    # Save results
    # ============================================================
    results = {
        "tier": "C",
        "timestamp": str(np.datetime64("now")),
        "c1_isolation_forest": {
            "full_dataset": {
                "precision": float(if_precision),
                "recall": float(if_recall),
                "f1": float(if_f1),
                "auc": float(if_auc),
                "confusion_matrix": if_cm.tolist(),
                "n_estimators": 200,
                "contamination": float(contamination),
            },
            "cv_5fold": {k: {"mean": float(np.mean(v)), "sd": float(np.std(v)), "values": [float(x) for x in v]}
                         for k, v in cv_metrics.items() if v},
            "fsm_3hop_baseline": {
                "precision": float(fsm_precision),
                "recall": float(fsm_recall),
                "f1": float(fsm_f1),
                "auc": float(fsm_auc),
                "confusion_matrix": fsm_cm.tolist(),
            },
        },
        "c2_confusion_matrices": {
            "files": [str(p) for p in sorted(fig_dir.glob("cm_*.png"))],
        },
        "c3_roc_curves": {
            "file": str(fig_dir / "roc_comparison.png"),
            "fsm_auc": float(fsm_auc) if 'auc_fsm' in dir() else None,
            "if_auc": float(if_auc),
        },
        "dataset": {
            "total_circuits": int(len(X)),
            "benign_circuits": int(np.sum(y == 0)),
            "attack_circuits": int(np.sum(y == 1)),
            "features_per_circuit": int(X.shape[1]),
            "feature_names": (
                [f"event_{e}" for e in EVENTS] +
                [f"state_{s}" for s in STATES] +
                ["violations", "seq_length", "valid_ratio"]
            ),
        },
    }

    out_path = EXPERIMENTS_DIR / "tier_c_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults written to {out_path}")

    print("\n=== TIER C Summary ===")
    print(f"C1: Isolation Forest — F1={if_f1:.4f}, AUC={if_auc:.4f}")
    print(f"    FSM 3-hop baseline — F1={fsm_f1:.4f}, AUC={fsm_auc:.4f}")
    winner = "FSM" if fsm_f1 >= if_f1 else "Isolation Forest"
    print(f"    Winner (F1): {winner}")
    print(f"C2: Confusion matrices saved to {fig_dir}/")
    print(f"C3: ROC curve saved to {fig_dir / 'roc_comparison.png'}")


if __name__ == "__main__":
    main()
