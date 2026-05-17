/*
 * C portu — δ-lookup + classifyInvalid hot path'i için cross-language latency.
 *
 * NOT a Tor port. Sadece JavaScript tarafındaki δ-tablo ve sınıflandırıcı
 * mantığının C/gcc -O3 altında ne kadar hızlı çalıştığını ölçer; bu sayede
 * Bölüm 4.6'daki "single-platform latency" sınırlılığı için Node.js V8 vs C
 * karşılaştırma noktası sağlar.
 *
 * Ölçüm protokolü Node tarafıyla aynı: probe, batch=1000, calibration,
 * 5000 örnek, CLOCK_MONOTONIC (hrtime karşılığı).
 *
 * Derleme: gcc -O3 -o c_latency c_latency.c
 */

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define N_STATES 10
#define N_EVENTS 13
#define TRIALS  30        /* match Node b_extensions REPEATS */
#define BATCH   100000    /* match Node b_extensions BATCH_SIZE */

/* States and events — same order as server/fsm.ts. */
static const char *STATE_NAMES[N_STATES] = {
    "IDLE","CONNECTING","TLS_HANDSHAKE","CREATE_SENT","CIRCUIT_BUILDING",
    "CIRCUIT_READY","TRANSMITTING","CLOSING","CLOSED","ERROR"};
static const char *EVENT_NAMES[N_EVENTS] = {
    "CONNECT","TLS_OK","TLS_FAIL","SEND_CREATE","RECV_CREATED",
    "SEND_EXTEND","RECV_EXTENDED","SEND_RELAY_DATA","RECV_RELAY_DATA",
    "SEND_DESTROY","RECV_DESTROY","CIRCUIT_CLOSED","TIMEOUT"};

/* δ: -1 = invalid; else next state index. Same mapping as VALID table. */
static int8_t DELTA[N_STATES][N_EVENTS];

static void init_delta(void) {
    for (int s = 0; s < N_STATES; s++)
        for (int e = 0; e < N_EVENTS; e++)
            DELTA[s][e] = -1;
    /* IDLE */
    DELTA[0][0] = 1;  /* CONNECT -> CONNECTING */
    /* CONNECTING */
    DELTA[1][1] = 2;  /* TLS_OK */    DELTA[1][2] = 9;  /* TLS_FAIL */    DELTA[1][12] = 9; /* TIMEOUT */
    /* TLS_HANDSHAKE */
    DELTA[2][3] = 3;  /* SEND_CREATE */ DELTA[2][2] = 9;  DELTA[2][12] = 9;
    /* CREATE_SENT */
    DELTA[3][4] = 4;  /* RECV_CREATED */ DELTA[3][12] = 9;
    /* CIRCUIT_BUILDING */
    DELTA[4][5] = 4;  /* SEND_EXTEND */ DELTA[4][6] = 5;  /* RECV_EXTENDED */ DELTA[4][12] = 9;
    /* CIRCUIT_READY */
    DELTA[5][7] = 6;  DELTA[5][8] = 6;  DELTA[5][9] = 7;  DELTA[5][10] = 7;  DELTA[5][12] = 9;
    /* TRANSMITTING */
    DELTA[6][7] = 6;  DELTA[6][8] = 6;  DELTA[6][9] = 7;  DELTA[6][10] = 7;  DELTA[6][12] = 9;
    /* CLOSING */
    DELTA[7][11] = 8; DELTA[7][12] = 8;
    /* CLOSED — none */
    /* ERROR */
    DELTA[9][11] = 8;
}

/* classifyInvalid — same nine-family logic as server/fsm.ts (return type+severity codes).
 * type: 0..7  (0=INVALID_TRANSITION fallback, 1..7 = the seven primary vectors)
 * severity: 0=LOW 1=MEDIUM 2=HIGH 3=CRITICAL                                         */
static inline int classify_invalid(int s, int e) {
    int data    = (e == 7 || e == 8);
    int create  = (e == 3 || e == 4);
    int extend  = (e == 5 || e == 6);
    int destroy = (e == 9 || e == 10);
    int dead    = (s == 8 || s == 9);

    if (data) {
        if (s == 0 || s == 1) return (1 << 4) | 3;          /* CIRCUIT_BYPASS / CRITICAL */
        if (s == 2)           return (4 << 4) | 3;          /* HANDSHAKE_SKIP / CRITICAL */
        if (s == 3 || s == 4) return (5 << 4) | 2;          /* PREMATURE_DATA / HIGH */
        if (s == 7)           return (2 << 4) | 1;          /* REPLAY_ATTACK / MEDIUM */
        if (s == 8)           return (2 << 4) | 3;          /* REPLAY_ATTACK / CRITICAL */
        if (s == 9)           return (3 << 4) | 1;          /* GHOST_CIRCUIT / MEDIUM */
    }
    if (create && (s == 5 || s == 6))    return (6 << 4) | 3;   /* CIRCUIT_HIJACK / CRITICAL */
    if (extend && (s == 5 || s == 6))    return (6 << 4) | 3;
    if (create && s == 3)                return (7 << 4) | 2;   /* CREATE_FLOOD / HIGH */
    if (e == 0 && s != 0)                return (3 << 4) | 1;   /* GHOST_CIRCUIT */
    if (e == 1 && s != 1)                return (3 << 4) | 1;
    if (e == 2 && s != 1 && s != 2)      return (3 << 4) | 1;
    if (destroy && !(s == 5 || s == 6))  return (3 << 4) | 2;
    if (e == 11 && !(s == 7 || s == 9))  return (3 << 4) | 1;
    if (e == 12 && dead)                 return (3 << 4) | 0;
    return (0 << 4) | 0; /* INVALID_TRANSITION fallback */
}

static inline uint64_t now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ULL + (uint64_t)ts.tv_nsec;
}

static int cmp_u64(const void *a, const void *b) {
    uint64_t x = *(const uint64_t *)a, y = *(const uint64_t *)b;
    return (x > y) - (x < y);
}

typedef struct { int s, e; const char *label; } probe_t;

/* Newton's method sqrt — avoid linking libm. */
static double sqrt_approx(double x) {
    if (x <= 0) return 0;
    double r = x;
    for (int i = 0; i < 30; i++) r = 0.5 * (r + x / r);
    return r;
}

static volatile int g_sink = 0;

static void measure(probe_t p, double overhead_ns) {
    uint64_t samples[TRIALS];
    volatile int s_idx = p.s, e_idx = p.e;  /* prevent constant-prop */

    /* Warm-up */
    for (int i = 0; i < BATCH * 5; i++) {
        int8_t nx = DELTA[s_idx][e_idx];
        int v = (nx < 0) ? classify_invalid(s_idx, e_idx) : nx;
        __asm__ volatile("" : : "r"(v) : "memory");
        g_sink ^= v;
    }

    for (int t = 0; t < TRIALS; t++) {
        uint64_t t0 = now_ns();
        for (int i = 0; i < BATCH; i++) {
            int8_t nx = DELTA[s_idx][e_idx];
            int v = (nx < 0) ? classify_invalid(s_idx, e_idx) : nx;
            __asm__ volatile("" : : "r"(v) : "memory");
            g_sink ^= v;
        }
        uint64_t dt = now_ns() - t0;
        double per = (double)dt / (double)BATCH - overhead_ns;
        if (per < 0) per = 0;
        samples[t] = (uint64_t)(per * 100); /* keep 2 decimal places */
    }

    qsort(samples, TRIALS, sizeof(uint64_t), cmp_u64);
    double sum = 0;
    for (int i = 0; i < TRIALS; i++) sum += samples[i];
    double m = sum / TRIALS;
    double var = 0;
    for (int i = 0; i < TRIALS; i++) { double d = samples[i] - m; var += d * d; }
    var /= (TRIALS - 1);

    printf("  \"%s\": {\n", p.label);
    printf("    \"mean_ns\": %.2f,\n", m / 100.0);
    printf("    \"sd_ns\":   %.2f,\n", sqrt_approx(var) / 100.0);
    printf("    \"p50_ns\":  %.2f,\n", (double)samples[TRIALS / 2] / 100.0);
    printf("    \"p95_ns\":  %.2f,\n", (double)samples[TRIALS * 95 / 100] / 100.0);
    printf("    \"min_ns\":  %.2f,\n", (double)samples[0] / 100.0);
    printf("    \"max_ns\":  %.2f\n",  (double)samples[TRIALS - 1] / 100.0);
    printf("  }");
}

int main(void) {
    init_delta();

    /* Calibrate loop overhead with empty body. */
    uint64_t cal[1000];
    for (int t = 0; t < 1000; t++) {
        uint64_t t0 = now_ns();
        for (int i = 0; i < BATCH; i++) { __asm__ volatile("" ::: "memory"); }
        cal[t] = now_ns() - t0;
    }
    qsort(cal, 1000, sizeof(uint64_t), cmp_u64);
    double overhead = (double)cal[500] / (double)BATCH;

    probe_t probes[3] = {
        { 0, 0,  "valid_step"        }, /* IDLE + CONNECT */
        { 0, 7,  "invalid_critical"  }, /* IDLE + SEND_RELAY_DATA -> CIRCUIT_BYPASS */
        { 9, 2, "invalid_low"       }, /* ERROR + TLS_FAIL -> GHOST/LOW (matches Node) */
    };

    printf("{\n");
    printf("  \"compiler\": \"gcc -O3\",\n");
    printf("  \"trials\": %d,\n", TRIALS);
    printf("  \"batch\": %d,\n", BATCH);
    printf("  \"overhead_ns_per_iter\": %.2f,\n", overhead);
    for (int i = 0; i < 3; i++) {
        measure(probes[i], overhead);
        printf("%s\n", i < 2 ? "," : "");
    }
    printf("}\n");
    fprintf(stderr, "sink=%d\n", g_sink); /* keep sink escaping */
    return 0;
}
