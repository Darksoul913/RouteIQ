import React, { useState, useEffect } from 'react';
import { ModelInfo, RouteResponse, AuditRecord, BenchmarkComparison } from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { GatewayPlayground } from './components/GatewayPlayground';
import { DecisionMatrix } from './components/DecisionMatrix';
import { ChaosPanel } from './components/ChaosPanel';
import { WorkloadComparison } from './components/WorkloadComparison';
import { AuditorLiveFeed } from './components/AuditorLiveFeed';
import { ModelCards } from './components/ModelCards';
import { EstimatorMetrics } from './components/EstimatorMetrics';

export default function App() {
  const [activeTab, setActiveTab] = useState<'gateway' | 'decision' | 'chaos' | 'benchmark' | 'audit'>('gateway');
  const [prompt, setPrompt] = useState('What is the capital of France and what is its population?');
  const [maxLatency, setMaxLatency] = useState(1000);
  const [maxCost, setMaxCost] = useState(0.005);
  const [minCapability, setMinCapability] = useState(0.35);
  const [requiredContext, setRequiredContext] = useState<number | undefined>(undefined);
  const [preference, setPreference] = useState('lowest_cost');

  const [loading, setLoading] = useState(false);
  const [benchLoading, setBenchLoading] = useState(false);
  const [response, setResponse] = useState<RouteResponse | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkComparison | null>(null);
  const [violations, setViolations] = useState(0);
  const [totalAudits, setTotalAudits] = useState(0);

  const fetchHealth = async () => {
    try {
      const data = await api.getHealth();
      setViolations(data.auditor_violations || 0);
      setTotalAudits(data.total_audited_requests || 0);
    } catch (e) {
      console.warn('Failed to fetch health status', e);
    }
  };

  const fetchModels = async () => {
    try {
      const data = await api.getModels();
      setModels(data);
    } catch (e) {
      console.warn('Failed to fetch models', e);
    }
  };

  const fetchAudit = async () => {
    try {
      const data = await api.getAudit();
      setAuditRecords(data.records || []);
      setViolations(data.violations_count || 0);
      setTotalAudits(data.total_records || 0);
    } catch (e) {
      console.warn('Failed to fetch audit records', e);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchModels();
  }, []);

  const handleRoute = async () => {
    setLoading(true);
    try {
      const data = await api.route({
        prompt,
        max_latency_ms: maxLatency,
        max_cost_usd: maxCost,
        min_capability: minCapability,
        required_context: requiredContext || null,
        preference,
        expected_output_tokens: 150,
      });
      setResponse(data);
      fetchHealth();
      fetchModels();
    } catch (err: any) {
      alert(`Route execution failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = async (name: 'budget' | 'latency' | 'code' | 'outage') => {
    if (name === 'budget') {
      setPrompt('What is the capital of France?');
      setMaxCost(0.0003);
      setMaxLatency(1000);
      setMinCapability(0.35);
    } else if (name === 'latency') {
      setPrompt('Quick query: opposite of generous?');
      setMaxLatency(250);
      setMaxCost(0.005);
      setMinCapability(0.35);
    } else if (name === 'code') {
      setPrompt('Write a Python function to check palindrome strings.');
      setMinCapability(0.75);
      setMaxLatency(800);
      setMaxCost(0.005);
    } else if (name === 'outage') {
      setPrompt('What is the capital of France?');
      setMaxCost(0.005);
      setMaxLatency(1000);
      setMinCapability(0.35);
      try {
        await api.setChaos({ model_id: 'llama-3.2-1b', kill_switch: true });
        await fetchModels();
        alert('Chaos Injected: Llama 3.2 1B kill switch activated! Now click Route Request.');
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  const handleUpdateChaos = async (modelId: string, addLatency: number, errorRate: number, killSwitch: boolean) => {
    try {
      await api.setChaos({
        model_id: modelId,
        add_latency_ms: addLatency,
        error_rate: errorRate,
        kill_switch: killSwitch,
      });
      await fetchModels();
    } catch (e: any) {
      alert(`Update chaos failed: ${e.message}`);
    }
  };

  const handleResetChaos = async () => {
    try {
      await api.resetChaos();
      await fetchModels();
      await fetchHealth();
      alert('All chaos injections and circuit breakers have been reset to default state.');
    } catch (e: any) {
      alert(`Reset chaos failed: ${e.message}`);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchLoading(true);
    try {
      const data = await api.runBenchmarkComparison(30);
      setBenchmarkData(data);
    } catch (e: any) {
      alert(`Benchmark error: ${e.message}`);
    } finally {
      setBenchLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    try {
      const data = await api.verifyChain();
      if (data.valid) {
        alert(`✅ SHA-256 HASH CHAIN VERIFIED!\n${data.message}`);
      } else {
        alert(`🚨 TAMPERING DETECTED!\n${data.message}`);
      }
    } catch (e: any) {
      alert(`Chain verification failed: ${e.message}`);
    }
  };

  const handleClearDb = async () => {
    if (confirm('Are you sure you want to clear all cryptographic audit logs?')) {
      try {
        await api.clearAudit();
        await fetchAudit();
        await fetchHealth();
      } catch (e: any) {
        alert(`Clear DB failed: ${e.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'chaos') fetchModels();
          if (tab === 'audit') fetchAudit();
        }}
        violations={violations}
        totalAudits={totalAudits}
        onResetChaos={handleResetChaos}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'gateway' && (
          <>
            <GatewayPlayground
              prompt={prompt}
              setPrompt={setPrompt}
              maxLatency={maxLatency}
              setMaxLatency={setMaxLatency}
              maxCost={maxCost}
              setMaxCost={setMaxCost}
              minCapability={minCapability}
              setMinCapability={setMinCapability}
              requiredContext={requiredContext}
              setRequiredContext={setRequiredContext}
              preference={preference}
              setPreference={setPreference}
              loading={loading}
              response={response}
              onRoute={handleRoute}
              onApplyPreset={handleApplyPreset}
            />
            {response && <EstimatorMetrics response={response} />}
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3">
                Registered Inference Models
              </h3>
              <ModelCards models={models} />
            </div>
          </>
        )}

        {activeTab === 'decision' && <DecisionMatrix response={response} />}

        {activeTab === 'chaos' && (
          <ChaosPanel
            models={models}
            onUpdateChaos={handleUpdateChaos}
            onResetChaos={handleResetChaos}
          />
        )}

        {activeTab === 'benchmark' && (
          <WorkloadComparison
            data={benchmarkData}
            loading={benchLoading}
            onRunBenchmark={handleRunBenchmark}
          />
        )}

        {activeTab === 'audit' && (
          <AuditorLiveFeed
            records={auditRecords}
            onVerifyChain={handleVerifyChain}
            onClearDb={handleClearDb}
          />
        )}
      </main>
    </div>
  );
}
