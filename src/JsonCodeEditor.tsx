import CodeMirror from '@uiw/react-codemirror';
import { json as jsonLanguage } from '@codemirror/lang-json';

export default function JsonCodeEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <CodeMirror
      value={value}
      height="min(65vh, 720px)"
      extensions={[jsonLanguage()]}
      onChange={onChange}
      theme="light"
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
    />
  );
}
