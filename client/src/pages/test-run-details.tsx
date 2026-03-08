import { useState } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { 
  ArrowLeft, Terminal, ShieldAlert, Cpu, 
  Zap, AlertTriangle, ArrowRight, PlayCircle
} from "lucide-react";
import { Link } from "wouter";
import { useTestRun } from "@/hooks/use-test-runs";
import { useTransitions } from "@/hooks/use-transitions";
import { useViolations } from "@/hooks/use-violations";
import { useSimulateFsm } from "@/hooks/use-fsm";
import { Card, Badge, Button, Table, Th, Td } from "@/components/ui-components";

export default function TestRunDetails() {
  const [, params] = useRoute("/test-runs/:id");
  const testRunId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: testRun, isLoading: loadingRun } = useTestRun(testRunId);
  const { data: transitions, isLoading: loadingTransitions } = useTransitions(testRunId);
  const { data: violations, isLoading: loadingViolations } = useViolations(testRunId);
  const simulateMutation = useSimulateFsm();

  const [simCount, setSimCount] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<'transitions' | 'violations'>('violations');

  const handleSimulate = async () => {
    if (!testRunId) return;
    await simulateMutation.mutateAsync({ testRunId, count: simCount });
  };

  if (loadingRun) {
    return <div className="p-12 text-center text-primary font-mono animate-pulse">DECRYPTING ENVIRONMENT DATA...</div>;
  }

  if (!testRun) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Sandbox Not Found</h2>
        <p className="text-muted-foreground mb-6 mt-2">The requested test environment could not be located in the registry.</p>
        <Link href="/">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running': return 'default';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const criticalCount = violations?.filter(v => v.severity.toLowerCase() === 'critical').length || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2 font-mono">
        <ArrowLeft className="w-4 h-4 mr-2" />
        RETURN_TO_DASHBOARD
      </Link>

      {/* Header Panel */}
      <Card className="p-6 relative overflow-hidden border-t-4 border-t-primary">
        <div className="absolute top-0 right-0 w-[500px] h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Terminal className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-bold font-mono tracking-tight text-white">{testRun.name}</h1>
              <Badge variant={getStatusVariant(testRun.status)} className="ml-2">
                {testRun.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm flex items-center">
              <Cpu className="w-4 h-4 mr-2 opacity-50" />
              Environment initialized at {format(new Date(testRun.createdAt), "MMMM dd, yyyy HH:mm:ss.SSS")}
            </p>
          </div>

          {/* Simulation Control Panel */}
          <div className="bg-background/80 border border-white/10 rounded-lg p-3 flex items-center space-x-3 shadow-xl backdrop-blur-md">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase text-muted-foreground font-bold mb-1 ml-1">Injection Vol.</label>
              <input 
                type="number" 
                value={simCount}
                onChange={(e) => setSimCount(parseInt(e.target.value) || 1)}
                min={1}
                max={100}
                className="w-20 bg-card border border-white/10 rounded-md px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button 
              onClick={handleSimulate} 
              disabled={simulateMutation.isPending || testRun.status === 'completed'}
              className="mt-4"
            >
              {simulateMutation.isPending ? (
                <Zap className="w-4 h-4 mr-2 animate-pulse" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Inject Events
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-white/10 space-x-8">
        <button 
          onClick={() => setActiveTab('violations')}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center ${activeTab === 'violations' ? 'text-destructive' : 'text-muted-foreground hover:text-white'}`}
        >
          <ShieldAlert className="w-4 h-4 mr-2" />
          Security Breaches ({violations?.length || 0})
          {activeTab === 'violations' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-destructive tech-glow-red rounded-t-md" />}
        </button>
        <button 
          onClick={() => setActiveTab('transitions')}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center ${activeTab === 'transitions' ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}
        >
          <Network className="w-4 h-4 mr-2" />
          Transition Log ({transitions?.length || 0})
          {activeTab === 'transitions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary tech-glow rounded-t-md" />}
        </button>
      </div>

      {/* Tab Content: Violations */}
      {activeTab === 'violations' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className={criticalCount > 0 ? 'border-destructive/30' : ''}>
            <div className="p-0">
              {loadingViolations ? (
                <div className="p-12 text-center text-muted-foreground font-mono">Parsing breach logs...</div>
              ) : violations?.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <ShieldCheck className="w-12 h-12 text-green-500/50 mb-4" />
                  <p className="text-green-400 font-mono text-lg">[OK] ZERO_VIOLATIONS_DETECTED</p>
                  <p className="text-muted-foreground text-sm mt-2">The state machine maintained perfect integrity.</p>
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Timestamp</Th>
                      <Th>Severity</Th>
                      <Th>Circuit ID</Th>
                      <Th>Attack Vector</Th>
                      <Th>State Context</Th>
                      <Th className="w-1/3">Description</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations?.map((v) => (
                      <tr key={v.id} className={`hover:bg-white/[0.02] transition-colors ${v.severity === 'critical' ? 'bg-destructive/[0.02]' : ''}`}>
                        <Td className="text-muted-foreground text-[10px] whitespace-nowrap">
                          {format(new Date(v.timestamp), "HH:mm:ss.SSS")}
                        </Td>
                        <Td>
                          <Badge variant={v.severity === 'critical' ? 'destructive' : v.severity === 'high' ? 'warning' : 'outline'}>
                            {v.severity.toUpperCase()}
                          </Badge>
                        </Td>
                        <Td className="text-white">{v.circuitId}</Td>
                        <Td className="text-orange-300 font-bold">{v.attackType}</Td>
                        <Td>
                          <div className="flex items-center space-x-1 text-xs opacity-80">
                            <span className="text-primary truncate max-w-[80px]" title={v.fromState}>{v.fromState}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-destructive truncate max-w-[80px]" title={v.attemptedState || 'UNKNOWN'}>{v.attemptedState || 'UNKNOWN'}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">Event: {v.event}</div>
                        </Td>
                        <Td className="text-xs font-sans text-muted-foreground leading-relaxed">
                          {v.description}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab Content: Transitions */}
      {activeTab === 'transitions' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card>
            <div className="p-0">
              {loadingTransitions ? (
                <div className="p-12 text-center text-muted-foreground font-mono">Parsing transition vectors...</div>
              ) : transitions?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-mono">No transitions recorded in this run.</div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Timestamp</Th>
                      <Th>Status</Th>
                      <Th>From State</Th>
                      <Th>Trigger Event</Th>
                      <Th>Resulting State</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitions?.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <Td className="text-muted-foreground text-[10px]">
                          {format(new Date(t.timestamp), "HH:mm:ss.SSS")}
                        </Td>
                        <Td>
                          {t.isValid ? (
                            <Badge variant="success" className="text-[10px]">VALID</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">INVALID</Badge>
                          )}
                        </Td>
                        <Td className="text-primary">{t.fromState}</Td>
                        <Td className="text-yellow-400/90 italic">{t.event}</Td>
                        <Td className={t.isValid ? 'text-white' : 'text-destructive font-bold'}>{t.toState}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
