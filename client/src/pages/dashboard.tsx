import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ShieldAlert, AlertTriangle, TerminalSquare, Plus, Activity, ServerCrash } from "lucide-react";
import { useTestRuns, useCreateTestRun } from "@/hooks/use-test-runs";
import { useAllViolations } from "@/hooks/use-violations";
import { Card, Badge, Button, Table, Th, Td } from "@/components/ui-components";

export default function Dashboard() {
  const { data: testRuns, isLoading: loadingRuns } = useTestRuns();
  const { data: violations, isLoading: loadingViolations } = useAllViolations();
  const createRun = useCreateTestRun();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRun = async () => {
    setIsCreating(true);
    try {
      await createRun.mutateAsync({
        name: `SANDBOX_ENV_${Math.floor(Math.random() * 10000)}`,
        status: 'running'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running': return 'default';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'outline';
      case 'low': return 'success';
      default: return 'outline';
    }
  };

  const criticalViolations = violations?.filter(v => v.severity.toLowerCase() === 'critical') || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-white">Security Operation Center</h1>
          <p className="text-muted-foreground font-mono text-sm">Monitoring Tor FSM state integrity across sandboxed environments</p>
        </div>
        <Button onClick={handleCreateRun} disabled={isCreating} className="shrink-0">
          {isCreating ? (
            <Activity className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {isCreating ? "Initializing..." : "Initialize Sandbox Run"}
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-primary/20"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <TerminalSquare className="w-6 h-6 text-primary" />
            </div>
            <Badge variant="outline">All Time</Badge>
          </div>
          <h3 className="text-3xl font-bold text-white font-mono">{testRuns?.length || 0}</h3>
          <p className="text-sm text-muted-foreground mt-1">Total Sandbox Runs</p>
        </Card>

        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-orange-500/20"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <Badge variant="outline">Detected Anomalies</Badge>
          </div>
          <h3 className="text-3xl font-bold text-white font-mono">{violations?.length || 0}</h3>
          <p className="text-sm text-muted-foreground mt-1">Total State Violations</p>
        </Card>

        <Card className="p-6 relative overflow-hidden group border-destructive/30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-destructive/20"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-destructive/10 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <Badge variant="destructive" className="animate-pulse">Active Threats</Badge>
          </div>
          <h3 className="text-3xl font-bold text-destructive font-mono">{criticalViolations.length}</h3>
          <p className="text-sm text-muted-foreground mt-1">Critical Security Breaches</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Sandbox Runs */}
        <Card className="flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary" />
              Recent Sandboxes
            </h2>
          </div>
          <div className="p-0">
            {loadingRuns ? (
              <div className="p-8 text-center text-muted-foreground font-mono animate-pulse">Scanning environments...</div>
            ) : testRuns?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No test runs initialized yet.</div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Environment ID</Th>
                    <Th>Status</Th>
                    <Th>Started At</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {testRuns?.slice(0, 5).map(run => (
                    <tr key={run.id} className="hover:bg-white/[0.02] transition-colors group">
                      <Td className="font-bold text-white">{run.name}</Td>
                      <Td>
                        <Badge variant={getStatusVariant(run.status)}>{run.status.toUpperCase()}</Badge>
                      </Td>
                      <Td className="text-muted-foreground">
                        {format(new Date(run.createdAt), "MMM dd, HH:mm:ss")}
                      </Td>
                      <Td className="text-right">
                        <Link href={`/test-runs/${run.id}`} className="text-primary text-xs font-semibold hover:underline">
                          ANALYZE &rarr;
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        {/* Recent Violations */}
        <Card className="flex flex-col border-destructive/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-destructive/50 to-orange-500/50"></div>
          <div className="p-6 border-b border-white/5 flex items-center justify-between pl-8">
            <h2 className="text-lg font-semibold flex items-center text-destructive">
              <ServerCrash className="w-5 h-5 mr-2" />
              Security Breaches Log
            </h2>
          </div>
          <div className="p-0">
            {loadingViolations ? (
              <div className="p-8 text-center text-muted-foreground font-mono animate-pulse">Compiling security logs...</div>
            ) : violations?.length === 0 ? (
              <div className="p-8 text-center text-green-400/70 font-mono">
                [OK] No security violations detected across any nodes.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="pl-8">Circuit ID</Th>
                    <Th>Severity</Th>
                    <Th>Attack Vector</Th>
                    <Th>Timestamp</Th>
                  </tr>
                </thead>
                <tbody>
                  {violations?.slice(0, 5).map(violation => (
                    <tr key={violation.id} className="hover:bg-destructive/5 transition-colors">
                      <Td className="pl-8 text-white">{violation.circuitId}</Td>
                      <Td>
                        <Badge variant={getSeverityVariant(violation.severity)}>{violation.severity.toUpperCase()}</Badge>
                      </Td>
                      <Td className="text-orange-300">{violation.attackType}</Td>
                      <Td className="text-muted-foreground text-[10px]">
                        {format(new Date(violation.timestamp), "HH:mm:ss.SSS")}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
