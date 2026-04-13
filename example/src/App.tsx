import React, { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  useBackgroundWorker,
  useWorker,
  WorkerPool,
} from 'react-native-background-workers';
import type { WorkerPoolStats } from 'react-native-background-workers';

WorkerPool.configure(3);

// ---------------------------------------------------------------------------
// Demo 1: useBackgroundWorker — long-lived worker with setup + onMessage
// ---------------------------------------------------------------------------
function HeavyComputationDemo() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { worker, isReady, setupError } = useBackgroundWorker<
    { count: number },
    { sum: number; avg: number; workerMs: number }
  >({
    name: 'HeavyComputationWorker',
    setup: () => {
      globalThis.__workerInitTime = performance.now();
    },
    onMessage: (msg) => {
      const start = performance.now();
      const { count } = msg;
      let sum = 0;
      for (let i = 1; i <= count; i++) {
        sum += i;
      }
      const avg = sum / count;
      const workerMs = performance.now() - start;
      return { sum, avg, workerMs };
    },
  });

  const handlePress = async () => {
    setLoading(true);
    const sendStart = performance.now();
    const res = await worker.send({ count: 1_000_000_000 });
    const roundTripMs = performance.now() - sendStart;

    setLoading(false);
    setResult(
      `Sum: ${res.sum}, Avg: ${res.avg.toFixed(2)}\n` +
        `Worker compute: ${res.workerMs.toFixed(1)}ms\n` +
        `Round-trip: ${roundTripMs.toFixed(1)}ms`
    );
  };

  return (
    <Section title="useBackgroundWorker">
      {setupError && (
        <ResultText style={styles.errorText}>Setup failed: {setupError.message}</ResultText>
      )}
      <Button
        label={isReady ? 'Compute stats (1B items)' : 'Setting up...'}
        disabled={loading || !isReady}
        onPress={handlePress}
      />
      {result && <ResultText>{result}</ResultText>}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Demo 2: useWorker — one-off simple task
// ---------------------------------------------------------------------------
function SimpleTaskDemo() {
  const { run, isLoading, data, error, cancel } = useWorker<number, number>(
    (n) => {
      let total = 0;
      for (let i = 0; i < n; i++) {
        total += Math.sqrt(i);
      }
      return total;
    },
    [],
    { timeout: 100_000, dedicated: false }
  );

  return (
    <Section title="useWorker (one-off)">
      <Button
        label="Sum of sqrt(0..10M)"
        onPress={() => run(10_000_000)}
        disabled={isLoading}
      />
      {isLoading && <ActivityIndicator style={styles.indicator} />}
      {data != null && <ResultText>Result: {data.toFixed(4)}</ResultText>}
      {error && <ResultText style={styles.errorText}>{error.message}</ResultText>}
      <Button label="Cancel" onPress={cancel} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Demo 3: useBackgroundWorker — pool mode (shared runtimes)
// ---------------------------------------------------------------------------
function PoolModeDemo() {
  const [results, setResults] = useState<string[]>([]);

  const { worker: primeWorker } = useBackgroundWorker<number, string>(
    {
      name: 'PrimeWorker',
      onMessage: (limit) => {
        const start = performance.now();
        let count = 0;
        for (let n = 2; n <= limit; n++) {
          let isPrime = true;
          for (let d = 2; d * d <= n; d++) {
            if (n % d === 0) { isPrime = false; break; }
          }
          if (isPrime) count++;
        }
        const ms = (performance.now() - start).toFixed(1);
        return `[Primes] found ${count} primes up to ${limit} in ${ms}ms`;
      },
    },
    { dedicated: false }
  );

  const { worker: hashWorker } = useBackgroundWorker<number, string>(
    {
      name: 'HashWorker',
      onMessage: (iterations) => {
        const start = performance.now();
        let hash = 0;
        for (let i = 0; i < iterations; i++) {
          hash = ((hash << 5) - hash + i) | 0;
        }
        const ms = (performance.now() - start).toFixed(1);
        return `[Hash] ${iterations} iterations → ${hash} in ${ms}ms`;
      },
    },
    { dedicated: false }
  );

  const { worker: fibWorker } = useBackgroundWorker<number, string>(
    {
      name: 'FibWorker',
      onMessage: (n) => {
        const start = performance.now();
        let a = 0, b = 1;
        for (let i = 0; i < n; i++) {
          const t = a + b;
          a = b;
          b = t;
        }
        const ms = (performance.now() - start).toFixed(1);
        return `[Fib] fib(${n}) last digits …${String(a).slice(-6)} in ${ms}ms`;
      },
    },
    { dedicated: false }
  );

  const { worker: sortWorker } = useBackgroundWorker<number, string>(
    {
      name: 'SortWorker',
      onMessage: (size) => {
        const start = performance.now();
        const arr = new Array(size);
        let seed = 42;
        for (let i = 0; i < size; i++) {
          seed = (seed * 1664525 + 1013904223) | 0;
          arr[i] = seed;
        }
        arr.sort((x: number, y: number) => x - y);
        const ms = (performance.now() - start).toFixed(1);
        return `[Sort] sorted ${size} items in ${ms}ms`;
      },
    },
    { dedicated: false }
  );

  const { worker: collatzWorker } = useBackgroundWorker<number, string>(
    {
      name: 'CollatzWorker',
      onMessage: (limit) => {
        const start = performance.now();
        let longest = 0;
        let longestN = 1;
        for (let n = 1; n <= limit; n++) {
          let steps = 0;
          let val = n;
          while (val !== 1) {
            val = val % 2 === 0 ? val / 2 : 3 * val + 1;
            steps++;
          }
          if (steps > longest) {
            longest = steps;
            longestN = n;
          }
        }
        const ms = (performance.now() - start).toFixed(1);
        return `[Collatz] longest chain in 1..${limit}: n=${longestN} (${longest} steps) in ${ms}ms`;
      },
    },
    { dedicated: false }
  );

  const handlePress = async () => {
    setResults([]);
    const all = await Promise.all([
      primeWorker.send(500_000),
      hashWorker.send(100_000_000),
      fibWorker.send(10_000_000),
      sortWorker.send(2_000_000),
      collatzWorker.send(100_000),
    ]);
    setResults(all as string[]);
  };

  return (
    <Section title="Pool mode (5 workers, 3 pool slots)">
      <Button label="Run all 5 tasks in parallel" onPress={handlePress} />
      {results.map((r, i) => (
        <ResultText key={i}>{r}</ResultText>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Demo 4: WorkerPool stats — live overview of all runtimes
// ---------------------------------------------------------------------------
function WorkerStatsDemo() {
  const [stats, setStats] = useState<WorkerPoolStats | null>(null);

  const refresh = () => {
    setStats(WorkerPool.shared().getStats());
  };

  return (
    <Section title="Worker Pool Stats">
      <Button label="Refresh stats" onPress={refresh} />
      {stats && (
        <View style={styles.statsContainer}>
          <ResultText>
            Total runtimes: {stats.totalRuntimes}
          </ResultText>

          <Text style={styles.statsLabel}>
            Dedicated ({stats.dedicatedCount}):
          </Text>
          {stats.dedicatedNames.length > 0 ? (
            stats.dedicatedNames.map((name) => (
              <ResultText key={name}>  {name}</ResultText>
            ))
          ) : (
            <ResultText>  (none)</ResultText>
          )}

          <Text style={styles.statsLabel}>
            Pool slots ({stats.pooledCount} / {stats.pooledMaxSize}):
          </Text>
          {stats.poolSlots.length > 0 ? (
            stats.poolSlots.map((slot) => (
              <View key={slot.slotName} style={styles.slotBlock}>
                <Text style={styles.slotName}>
                  {slot.slotName} ({slot.totalPending} pending)
                </Text>
                {slot.workers.map((w) => (
                  <ResultText key={w.workerName}>
                    {`  ${w.workerName} — ${w.pendingTasks} pending`}
                  </ResultText>
                ))}
              </View>
            ))
          ) : (
            <ResultText>  (none yet)</ResultText>
          )}

          <Text style={styles.statsLabel}>All workers:</Text>
          {stats.workers.map((w) => (
            <ResultText key={w.name}>
              {`  ${w.name} [${w.type}]${w.poolSlot ? ` → ${w.poolSlot}` : ''} — ${w.pendingTasks} pending`}
            </ResultText>
          ))}
        </View>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Demo 5: Setup error — intentionally failing setup
// ---------------------------------------------------------------------------
function SetupErrorDemo() {
  const [sendResult, setSendResult] = useState<string | null>(null);

  const { worker, isReady, setupError } = useBackgroundWorker<string, string>({
    name: 'FailingWorker',
    setup: () => {
      throw new Error('Model file not found: weights.bin');
    },
    onMessage: (msg) => {
      return `echo: ${msg}`;
    },
  });

  const handlePress = async () => {
    try {
      const res = await worker.send('hello');
      setSendResult(res);
    } catch (err) {
      setSendResult(`send() threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  console.log('setupError', setupError?.message);

  return (
    <Section title="Setup error handling">
      <ResultText>
        isReady: {String(isReady)}
      </ResultText>
      {setupError && (
        <ResultText style={styles.errorText}>
          setupError: {setupError.message}
        </ResultText>
      )}
      <Button
        label={isReady ? 'Send message' : setupError ? 'Setup failed — try send anyway' : 'Setting up...'}
        onPress={handlePress}
      />
      {sendResult && <ResultText>{sendResult}</ResultText>}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.heading}>react-native-background-workers</Text>
      <WorkerStatsDemo />
      <HeavyComputationDemo />
      <SetupErrorDemo />
      <SimpleTaskDemo />
      <PoolModeDemo />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function ResultText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <Text style={[styles.result, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 64,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  result: {
    fontSize: 13,
    color: '#555',
    marginTop: 6,
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#dc2626',
  },
  statsContainer: {
    marginTop: 8,
    gap: 2,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 6,
    fontFamily: 'monospace',
  },
  slotBlock: {
    marginTop: 4,
    marginLeft: 4,
  },
  slotName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4f46e5',
    fontFamily: 'monospace',
  },
  indicator: {
    marginTop: 8,
  },
});
