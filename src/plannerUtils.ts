import { CategoryType, TaskItem } from './types';

export const INDEX_SYMBOLS = [
  '①',
  '②',
  '③',
  '④',
  '⑤',
  '⑥',
  '⑦',
  '⑧',
  '⑨',
  '⑩',
  '⑪',
  '⑫',
  '⑬',
  '⑭',
  '⑮',
  '⑯',
  '⑰',
  '⑱',
  '⑲',
  '⑳',
];

export function getIndexSymbol(index: number) {
  return INDEX_SYMBOLS[index] ?? `${index + 1}`;
}

export function getTaskCategory(task?: TaskItem | null): CategoryType {
  return task?.category ?? 'work';
}

export function getLinkedTask(tasks: TaskItem[], taskRef: number | null) {
  if (!taskRef) return null;
  return tasks.find((task) => task.id === taskRef) ?? null;
}

export function getBlockTaskRefs<T extends { taskRef: number | null; taskRefs?: number[] }>(block: T) {
  const refs = [block.taskRef, ...(block.taskRefs ?? [])].filter((ref): ref is number => typeof ref === 'number');
  return [...new Set(refs)];
}

export function getPrimaryTaskRef<T extends { taskRef: number | null; taskRefs?: number[] }>(block: T) {
  return block.taskRef ?? block.taskRefs?.[0] ?? null;
}

export function getSecondaryTaskRefs<T extends { taskRef: number | null; taskRefs?: number[] }>(block: T) {
  const primaryRef = getPrimaryTaskRef(block);
  return getBlockTaskRefs(block).filter((ref) => ref !== primaryRef);
}

export function getBlockCategory<T extends { taskRef: number | null; taskRefs?: number[]; category: CategoryType }>(
  tasks: TaskItem[],
  block: T,
): CategoryType {
  const linkedTask = getLinkedTask(tasks, getPrimaryTaskRef(block));
  return linkedTask?.category ?? block.category ?? 'other';
}

export function getNextTaskId(tasks: TaskItem[]) {
  return tasks.reduce((maxId, task) => Math.max(maxId, task.id), 0) + 1;
}
