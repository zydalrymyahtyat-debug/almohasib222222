import { performance } from "perf_hooks";

// Mock types
interface Person {
  id: string;
}

interface Transaction {
  id: string;
  personId: string;
  amount: number;
}

// Generate data
const personsCount = 1000;
const transactionsCount = 10000;

const persons: Person[] = [];
for (let i = 0; i < personsCount; i++) {
  persons.push({ id: `person_${i}` });
}

const transactions: Transaction[] = [];
for (let i = 0; i < transactionsCount; i++) {
  transactions.push({
    id: `tx_${i}`,
    personId: `person_${Math.floor(Math.random() * personsCount)}`,
    amount: Math.random() * 100
  });
}

function beforeOptimization() {
  const start = performance.now();
  let totalStartBalance = 0;
  for (const p of persons) {
    const pTx = transactions.filter(t => t.personId === p.id);
    let startBalance = 0;
    for (const t of pTx) {
      startBalance += t.amount;
    }
    totalStartBalance += startBalance;
  }
  const end = performance.now();
  return { time: end - start, totalStartBalance };
}

function afterOptimization() {
  const start = performance.now();
  let totalStartBalance = 0;

  const transactionsByPerson: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    if (!transactionsByPerson[t.personId]) {
      transactionsByPerson[t.personId] = [];
    }
    transactionsByPerson[t.personId].push(t);
  }

  for (const p of persons) {
    const pTx = transactionsByPerson[p.id] || [];
    let startBalance = 0;
    for (const t of pTx) {
      startBalance += t.amount;
    }
    totalStartBalance += startBalance;
  }
  const end = performance.now();
  return { time: end - start, totalStartBalance };
}

// Warmup
beforeOptimization();
afterOptimization();

// Run
const before = beforeOptimization();
const after = afterOptimization();

console.log(`Before: ${before.time.toFixed(2)}ms`);
console.log(`After: ${after.time.toFixed(2)}ms`);
console.log(`Speedup: ${(before.time / after.time).toFixed(2)}x`);
console.log(`Results match: ${before.totalStartBalance === after.totalStartBalance}`);
