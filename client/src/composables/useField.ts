import { inject, type InjectionKey } from 'vue';
export const fieldKey: InjectionKey<{ id: string; hintId: string }> = Symbol('field');
export function useField() {
  return inject(fieldKey, undefined);
}
