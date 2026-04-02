export type WebflowNodeKind =
  | 'page-root'
  | 'section'
  | 'container'
  | 'div'
  | 'grid'
  | 'stack'
  | 'heading'
  | 'text'
  | 'list'
  | 'list-item'
  | 'image'
  | 'button'
  | 'link'
  | 'form'
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'submit'
  | 'embed';

export interface WebflowResponsive {
  desktop?: Record<string, string>;
  tablet?: Record<string, string>;
  mobileLandscape?: Record<string, string>;
  mobilePortrait?: Record<string, string>;
}

export interface WebflowNode {
  id: string;
  kind: WebflowNodeKind;
  tag: string;
  styleIds?: string[];
  comboStyleIds?: string[];
  children: WebflowNode[];
  content?: { text?: string; html?: string };
  attributes?: Record<string, string>;
  assetId?: string;
  componentId?: string;
  responsive: WebflowResponsive;
}

export interface WebflowStyle {
  id: string;
  name: string;
  properties: Record<string, string>;
  tokenBindings?: Record<string, string>;
  pseudo?: Record<'hover' | 'focus' | 'active', Record<string, string>>;
  responsive?: WebflowResponsive;
}

export interface WebflowVariable {
  id: string;
  name: string;
  value: string;
  type: 'color' | 'font' | 'spacing' | 'radius' | 'shadow';
}

export interface WebflowAsset {
  id: string;
  type: 'image' | 'video' | 'icon';
  source: string;
  alt?: string;
  usedByNodeIds: string[];
}

export interface WebflowComponent {
  id: string;
  name: string;
  rootNodeId: string;
  instanceNodeIds: string[];
  reuseConfidence: number;
}

export interface WebflowUnsupported {
  id: string;
  nodeId: string;
  reason: string;
  snippet?: string;
  fallback: 'native-alternative-available' | 'requires-custom-code' | 'blocked';
}

export interface WebflowPage {
  id: string;
  name: string;
  path: string;
  rootNode: WebflowNode;
  sections: string[];
}

export interface WebflowValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WebflowSchema {
  meta: {
    projectName: string;
    version: string;
    exportTimestamp: string;
    sourceArtifactId: string;
    sourceFormat: 'selected-html-snapshot';
  };
  variables: WebflowVariable[];
  styles: WebflowStyle[];
  assets: WebflowAsset[];
  components: WebflowComponent[];
  pages: WebflowPage[];
  unsupported: WebflowUnsupported[];
  customCodePolicy: {
    allowCustomCode: false;
    allowedOnlyFor: string[];
    forbiddenFor: string[];
  };
  importHints: {
    primaryContract: 'native-webflow-json';
    htmlRole: 'preview-debug-only';
    breakpoints: string[];
  };
  validationReport?: WebflowValidationReport;
  siteStructure?: {
    sectionCount: number;
    nodeCount: number;
  };
}

export interface WebflowExportResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  output?: WebflowSchema;
}
