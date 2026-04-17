export interface FieldProps<T> {
  value: T;
  onChange: (val: T) => void;
  isFocused: boolean;
}
