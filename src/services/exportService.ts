/**
 * @file exportService.ts
 * @description HTML export, design package creation, and native-first Webflow export services.
 */

import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { Artifact } from '../types/index';
import {
  WebflowAsset,
  WebflowComponent,
  WebflowExportResult,
  WebflowNode,
  WebflowNodeKind,
  WebflowPage,
  WebflowSchema,
  WebflowStyle,
  WebflowUnsupported,
  WebflowVariable,
} from '../types/webflow';

const BREAKPOINTS = ['desktop', 'tablet', 'mobileLandscape', 'mobilePortrait'] as const;
const MAJOR_LAYOUT_KINDS: WebflowNodeKind[] = ['page-root', 'section', 'container', 'div', 'grid', 'stack', 'form'];

export const exportHtml = (html: string, fileName: string) => {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportDesignPackage = async (html: string, artifactName: string) => {
  const zip = new JSZip();

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.width = '1440px';
  iframe.style.height = '1000px';
  document.body.appendChild(iframe);

  iframe.setAttribute('srcdoc', html);
  await new Promise((resolve) => (iframe.onload = resolve));

  const canvas = await html2canvas(iframe.contentDocument!.body, { width: 1440 });
  const screenshot = canvas.toDataURL('image/png').split(',')[1];
  zip.file('screenshot.png', screenshot, { base64: true });

  const metadata = {
    name: artifactName,
    timestamp: Date.now(),
    breakpoints: { desktop: '1440px', tablet: '991px', mobile: '478px' },
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  zip.file('source.html', html);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${artifactName}-package.zip`;
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(iframe);
};

const stableId = (prefix: string, path: string) => `${prefix}-${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

const sanitizeText = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();

const getResponsiveShape = () => ({
  desktop: {},
  tablet: {},
  mobileLandscape: {},
  mobilePortrait: {},
});

const mapTagToKind = (el: Element): WebflowNodeKind => {
  const tag = el.tagName.toLowerCase();
  if (tag === 'section') return 'section';
  if (tag === 'main' || tag === 'header' || tag === 'footer' || tag === 'article') return 'container';
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return 'heading';
  if (tag === 'p' || tag === 'span' || tag === 'label' || tag === 'blockquote') return 'text';
  if (tag === 'ul' || tag === 'ol') return 'list';
  if (tag === 'li') return 'list-item';
  if (tag === 'img') return 'image';
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'form') return 'form';
  if (tag === 'input') {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'submit') return 'submit';
    return 'input';
  }
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  if (tag === 'iframe' || tag === 'script' || tag === 'embed') return 'embed';
  const style = (el.getAttribute('style') || '').toLowerCase();
  if (style.includes('display:grid')) return 'grid';
  if (style.includes('display:flex')) return 'stack';
  return 'div';
};

const isMeaningfulStyle = (properties: Record<string, string>) =>
  Object.values(properties).some((v) => !!v && v !== 'normal' && v !== 'rgba(0, 0, 0, 0)');

const buildStyleProperties = (computed: CSSStyleDeclaration): Record<string, string> => ({
  display: computed.display,
  position: computed.position,
  color: computed.color,
  backgroundColor: computed.backgroundColor,
  fontFamily: computed.fontFamily,
  fontSize: computed.fontSize,
  fontWeight: computed.fontWeight,
  lineHeight: computed.lineHeight,
  letterSpacing: computed.letterSpacing,
  gap: computed.gap,
  padding: computed.padding,
  margin: computed.margin,
  border: computed.border,
  borderRadius: computed.borderRadius,
  boxShadow: computed.boxShadow,
  textAlign: computed.textAlign,
  width: computed.width,
  maxWidth: computed.maxWidth,
  minHeight: computed.minHeight,
});

const collectVariables = (doc: Document, view: Window): WebflowVariable[] => {
  const rootStyles = view.getComputedStyle(doc.documentElement);
  const variables: WebflowVariable[] = [];

  for (let i = 0; i < rootStyles.length; i++) {
    const name = rootStyles.item(i);
    if (!name.startsWith('--')) continue;
    const value = rootStyles.getPropertyValue(name).trim();
    if (!value) continue;

    let type: WebflowVariable['type'] = 'spacing';
    if (name.includes('color') || value.startsWith('rgb') || value.startsWith('#')) type = 'color';
    else if (name.includes('font')) type = 'font';
    else if (name.includes('radius')) type = 'radius';
    else if (name.includes('shadow')) type = 'shadow';

    variables.push({ id: stableId('var', name), name, value, type });
  }

  return variables;
};

const createRenderDocument = async (html: string): Promise<{ iframe: HTMLIFrameElement; doc: Document }> => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '1440px';
  iframe.style.height = '1200px';
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  await new Promise((resolve) => (iframe.onload = resolve));
  return { iframe, doc: iframe.contentDocument! };
};

const parseHtmlToWebflowJson = async (html: string, artifact: Artifact): Promise<WebflowSchema> => {
  const { iframe, doc } = await createRenderDocument(html);

  const styleMap = new Map<string, WebflowStyle>();
  const styles: WebflowStyle[] = [];
  const assets: WebflowAsset[] = [];
  const unsupported: WebflowUnsupported[] = [];
  const allNodes: WebflowNode[] = [];
  const signatureBuckets = new Map<string, string[]>();

  const registerStyle = (el: Element, nodePath: string): string[] => {
    const computed = iframe.contentWindow!.getComputedStyle(el as HTMLElement);
    const classNames = Array.from(el.classList);
    const baseName = classNames[0] || `${el.tagName.toLowerCase()}-${nodePath}`;
    const styleId = stableId('style', baseName);

    if (!styleMap.has(styleId)) {
      const properties = buildStyleProperties(computed);
      if (isMeaningfulStyle(properties)) {
        const style: WebflowStyle = {
          id: styleId,
          name: baseName,
          properties,
          tokenBindings: Object.fromEntries(
            Object.entries(properties).filter(([, value]) => value.includes('var(--')),
          ),
          responsive: getResponsiveShape(),
        };
        styleMap.set(styleId, style);
        styles.push(style);
      }
    }

    return styles.find((s) => s.id === styleId) ? [styleId] : [];
  };

  const registerAsset = (el: Element, nodeId: string) => {
    if (el.tagName.toLowerCase() !== 'img') return undefined;
    const src = el.getAttribute('src') || '';
    if (!src) return undefined;
    const assetId = stableId('asset', src);
    const existing = assets.find((a) => a.id === assetId);
    if (existing) {
      existing.usedByNodeIds.push(nodeId);
      return assetId;
    }
    assets.push({
      id: assetId,
      type: 'image',
      source: src,
      alt: el.getAttribute('alt') || undefined,
      usedByNodeIds: [nodeId],
    });
    return assetId;
  };

  const registerUnsupported = (el: Element, nodeId: string) => {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'script' && tag !== 'iframe' && tag !== 'embed') return;
    const snippet = sanitizeText(el.outerHTML).slice(0, 240);
    unsupported.push({
      id: stableId('unsupported', nodeId),
      nodeId,
      reason: `Unsupported native mapping for <${tag}>`,
      snippet,
      fallback: tag === 'script' ? 'requires-custom-code' : 'native-alternative-available',
    });
  };

  const buildNode = (el: Element, path: string): WebflowNode => {
    const id = stableId('node', path);
    const kind = mapTagToKind(el);

    const node: WebflowNode = {
      id,
      kind,
      tag: el.tagName.toLowerCase(),
      styleIds: registerStyle(el, path),
      comboStyleIds: Array.from(el.classList).slice(1).map((name) => stableId('style', name)),
      children: [],
      responsive: getResponsiveShape(),
      attributes: {},
    };

    if (kind === 'heading' || kind === 'text' || kind === 'link' || kind === 'button') {
      node.content = { text: sanitizeText(el.textContent) };
    }

    if (kind === 'link' && el.getAttribute('href')) node.attributes!.href = el.getAttribute('href')!;
    if (kind === 'image') node.assetId = registerAsset(el, id);

    registerUnsupported(el, id);

    node.children = Array.from(el.children).map((child, index) => buildNode(child, `${path}_${index}`));

    allNodes.push(node);

    const signature = `${node.tag}|${(node.styleIds || []).join(',')}|${node.children.map((c) => c.tag).join(',')}`;
    const existing = signatureBuckets.get(signature) || [];
    existing.push(id);
    signatureBuckets.set(signature, existing);

    return node;
  };

  const bodyChildren = Array.from(doc.body.children);
  const rootNode: WebflowNode = {
    id: stableId('node', `${artifact.id}_root`),
    kind: 'page-root',
    tag: 'body',
    children: bodyChildren.map((el, i) => buildNode(el, `${artifact.id}_${i}`)),
    responsive: getResponsiveShape(),
  };

  const sections = allNodes.filter((node) => node.kind === 'section').map((node) => node.id);

  const components: WebflowComponent[] = Array.from(signatureBuckets.entries())
    .filter(([, ids]) => ids.length >= 2)
    .map(([signature, ids], index) => ({
      id: stableId('component', `${index}_${signature}`),
      name: `Reusable ${index + 1}`,
      rootNodeId: ids[0],
      instanceNodeIds: ids,
      reuseConfidence: Math.min(1, 0.55 + ids.length * 0.1),
    }));

  const page: WebflowPage = {
    id: stableId('page', artifact.id),
    name: artifact.styleName || 'Landing Page',
    path: '/',
    rootNode,
    sections,
  };

  try {
    return {
      meta: {
        projectName: artifact.styleName || 'AI Website',
        version: '3.0.0',
        exportTimestamp: new Date().toISOString(),
        sourceArtifactId: artifact.id,
        sourceFormat: 'selected-html-snapshot',
      },
      variables: collectVariables(doc, iframe.contentWindow!),
      styles,
      assets,
      components,
      pages: [page],
      unsupported,
      customCodePolicy: {
        allowCustomCode: false,
        allowedOnlyFor: ['third-party widgets', 'provider embeds', 'unsupported advanced behavior'],
        forbiddenFor: ['layout', 'structure', 'styling', 'responsive behavior', 'standard landing-page patterns'],
      },
      importHints: {
        primaryContract: 'native-webflow-json',
        htmlRole: 'preview-debug-only',
        breakpoints: ['desktop', 'tablet', 'mobileLandscape', 'mobilePortrait'],
      },
      siteStructure: {
        sectionCount: sections.length,
        nodeCount: allNodes.length + 1,
      },
    };
  } finally {
    document.body.removeChild(iframe);
  }
};

export const validateWebflowExport = (json: WebflowSchema): WebflowExportResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredKeys: (keyof WebflowSchema)[] = [
    'meta',
    'variables',
    'styles',
    'assets',
    'components',
    'pages',
    'unsupported',
    'customCodePolicy',
    'importHints',
  ];

  requiredKeys.forEach((key) => {
    if (json[key] === undefined || json[key] === null) errors.push(`Missing required key: ${String(key)}`);
  });

  if (!Array.isArray(json.pages) || json.pages.length === 0) errors.push('Pages array must not be empty');

  const nodeIds = new Set<string>();

  const checkNode = (node: WebflowNode, path: string, unsupportedNodeIds: Set<string>) => {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id found: ${node.id}`);
    nodeIds.add(node.id);

    if (!node.responsive || BREAKPOINTS.some((bp) => !(bp in node.responsive))) {
      errors.push(`Node ${node.id} missing responsive breakpoint structure`);
    }

    if (MAJOR_LAYOUT_KINDS.includes(node.kind) && node.styleIds?.length === 0) {
      warnings.push(`Major layout node ${node.id} has no styles mapped`);
    }

    if ((node.kind === 'heading' || node.kind === 'text' || node.kind === 'link' || node.kind === 'button') && !node.content?.text) {
      errors.push(`Text-bearing node ${node.id} is missing content.text`);
    }

    if (node.kind === 'embed' && !unsupportedNodeIds.has(node.id)) {
      errors.push(`Unsupported/embed node ${node.id} missing from unsupported[]`);
    }

    if (node.kind === 'link' && node.tag !== 'a') errors.push(`Semantic mapping failure at ${path}: link must map to <a>`);
    if (node.kind === 'heading' && !/^h[1-6]$/.test(node.tag)) errors.push(`Semantic mapping failure at ${path}: heading must map to <h1>-<h6>`);
    if (node.kind === 'list' && node.tag !== 'ul' && node.tag !== 'ol') errors.push(`Semantic mapping failure at ${path}: list must map to <ul>/<ol>`);

    node.children.forEach((child, index) => checkNode(child, `${path}.${index}`, unsupportedNodeIds));
  };

  const unsupportedNodeIds = new Set((json.unsupported || []).map((u) => u.nodeId));

  json.pages?.forEach((page, index) => {
    if (!page.rootNode) {
      errors.push(`Page ${index} rootNode is required`);
      return;
    }
    if (page.rootNode.kind !== 'page-root') errors.push(`Page ${index} rootNode.kind must be page-root`);
    if (!Array.isArray(page.rootNode.children) || page.rootNode.children.length === 0) {
      errors.push(`Page ${index} rootNode.children must not be empty`);
    }
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`Page ${index} sections must not be empty`);
    }

    checkNode(page.rootNode, `pages[${index}].rootNode`, unsupportedNodeIds);
  });

  if (!Array.isArray(json.styles) || json.styles.length === 0) errors.push('Styles array must not be empty');
  if (Array.isArray(json.styles) && json.styles.every((style) => !isMeaningfulStyle(style.properties))) {
    errors.push('Styles are present but not meaningful');
  }

  if (json.assets.length === 0) {
    const hasImageNodes = json.pages.some((page) => {
      const queue = [...page.rootNode.children];
      while (queue.length) {
        const node = queue.shift()!;
        if (node.kind === 'image') return true;
        queue.push(...node.children);
      }
      return false;
    });
    if (hasImageNodes) errors.push('Assets cannot be empty when image nodes are present');
  }

  const requiresCustomCode = json.unsupported.some((item) => item.fallback === 'requires-custom-code');
  if (requiresCustomCode && !json.customCodePolicy.allowCustomCode) {
    warnings.push('Unsupported öğeler custom code gerektiriyor; import sırasında manuel aksiyon gerekecek.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    output: json,
  };
};

export const exportToWebflow = async (artifact: Artifact): Promise<WebflowExportResult> => {
  const webflowJson = await parseHtmlToWebflowJson(artifact.html, artifact);
  const validation = validateWebflowExport(webflowJson);

  if (!validation.valid || !validation.output) {
    return validation;
  }

  validation.output.validationReport = {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
  };

  const blob = new Blob([JSON.stringify(validation.output, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${artifact.id || 'design'}-webflow.json`;
  a.click();
  URL.revokeObjectURL(url);

  return validation;
};
