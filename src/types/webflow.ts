export interface WebflowNode {
  id: string;
  kind: string;
  tag: string;
  styleId?: string;
  children?: WebflowNode[];
  content?: { text: string };
  componentId?: string;
}

export interface WebflowStyle {
  id: string;
  name: string;
  properties: Record<string, string>;
  breakpoints?: Record<string, Record<string, string>>;
}

export interface WebflowVariable {
  id: string;
  name: string;
  value: string;
  type: 'color' | 'font' | 'spacing';
}

export interface WebflowSchema {
  meta: { projectName: string; version: string };
  variables: WebflowVariable[];
  styles: WebflowStyle[];
  nodes: WebflowNode[];
  components: Record<string, WebflowNode>;
}
