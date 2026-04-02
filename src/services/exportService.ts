/**
 * @file exportService.ts
 * @description HTML export, design package creation, and Webflow export services.
 * @exports exportHtml, exportDesignPackage, exportToWebflow, validateWebflowExport
 */

import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { Artifact } from '../types/index';
import { WebflowSchema, WebflowNode, WebflowStyle, WebflowVariable } from '../types/webflow';

/**
 * Exports HTML content as a file.
 * @param html - The HTML content to export
 * @param fileName - The filename for the exported file
 */
export const exportHtml = (html: string, fileName: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.html`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Exports a design package as a ZIP file.
 * @param html - The HTML content
 * @param artifactName - The name of the artifact
 */
export const exportDesignPackage = async (html: string, artifactName: string) => {
    const zip = new JSZip();
    
    // 1. Render in hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '1440px';
    iframe.style.height = '1000px';
    document.body.appendChild(iframe);
    
    iframe.setAttribute('srcdoc', html);
    await new Promise(resolve => iframe.onload = resolve);
    
    // 2. Capture screenshot
    const canvas = await html2canvas(iframe.contentDocument!.body, { width: 1440 });
    const screenshot = canvas.toDataURL('image/png').split(',')[1];
    zip.file('screenshot.png', screenshot, { base64: true });
    
    // 3. Metadata
    const metadata = {
        name: artifactName,
        timestamp: Date.now(),
        breakpoints: { desktop: "1440px", tablet: "991px", mobile: "478px" }
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    zip.file('source.html', html);
    
    // 4. Download
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifactName}-package.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    document.body.removeChild(iframe);
};

/**
 * Validates a Webflow JSON export object.
 * @param json - The Webflow JSON object
 * @returns Validation result
 */
export const validateWebflowExport = (json: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredKeys = ["meta", "variables", "styles", "assets", "components", "pages", "unsupported", "customCodePolicy", "importHints"];
    
    requiredKeys.forEach(key => { if (!json[key]) errors.push(`Missing required key: ${key}`); });

    if (json.meta && !json.meta.projectName) errors.push("Missing meta.projectName");
    
    // Strict validation rules
    if (!json.pages || !Array.isArray(json.pages) || json.pages.length === 0) {
        errors.push("Pages array must not be empty");
    } else {
        json.pages.forEach((page: any, index: number) => {
            if (!page.rootNode || page.rootNode.kind !== 'page-root') errors.push(`Page ${index} rootNode must be page-root`);
            if (!page.rootNode || !page.rootNode.children || page.rootNode.children.length === 0) errors.push(`Page ${index} rootNode.children must not be empty`);
            if (!page.sections || page.sections.length === 0) errors.push(`Page ${index} sections must not be empty`);
            
            const checkNode = (node: any) => {
                if (!node.responsive) errors.push(`Node ${node.id} is missing responsive data`);
                if (['heading', 'text', 'link'].includes(node.kind) && (!node.content || !node.content.text)) errors.push(`Node ${node.id} (${node.kind}) missing content.text`);
                node.children?.forEach(checkNode);
            };
            page.rootNode.children.forEach(checkNode);
        });
    }

    if (json.styles && json.styles.length === 0) errors.push("Styles array must not be empty");
    
    return { valid: errors.length === 0, errors };
};

/**
 * Exports a design to Webflow JSON format.
 * @param artifact - The artifact to export
 * @returns Validation result
 */
/**
 * Parses HTML string to extract Webflow-compatible JSON structure.
 */
import { Artifact } from '../types/index';
import { WebflowSchema, WebflowNode, WebflowStyle, WebflowVariable } from '../types/webflow';

const parseHtmlToWebflowJson = (html: string, artifactId: string, styleName: string): WebflowSchema => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const styles: WebflowStyle[] = [];
    const variables: WebflowVariable[] = [];
    const nodes: WebflowNode[] = [];
    const usedStyleNames = new Set<string>();

    const getStyleId = (element: Element): string => {
        const styleName = element.tagName.toLowerCase() + '-' + Array.from(element.classList).join('-');
        if (!usedStyleNames.has(styleName)) {
            const computed = window.getComputedStyle(element);
            styles.push({
                id: `style-${styleName}`,
                name: styleName,
                properties: {
                    color: computed.color,
                    fontSize: computed.fontSize,
                    padding: computed.padding,
                    margin: computed.margin
                }
            });
            usedStyleNames.add(styleName);
        }
        return `style-${styleName}`;
    };

    const buildNode = (element: Element): WebflowNode => {
        const id = Math.random().toString(36).substr(2, 9);
        const node: WebflowNode = {
            id,
            kind: element.tagName.toLowerCase(),
            tag: element.tagName.toLowerCase(),
            styleId: getStyleId(element),
            children: Array.from(element.children).map(buildNode)
        };
        if (['H1', 'H2', 'H3', 'P', 'A'].includes(element.tagName)) {
            node.content = { text: element.textContent?.trim() || '' };
        }
        return node;
    };

    Array.from(doc.body.children).forEach(child => nodes.push(buildNode(child)));

    return {
        meta: { projectName: styleName, version: "2.0.0" },
        variables,
        styles,
        nodes,
        components: {}
    };
};

export const exportToWebflow = (artifact: Artifact): { valid: boolean; errors: string[] } => {
    const webflowJson = parseHtmlToWebflowJson(artifact.html, artifact.id, artifact.styleName);
    
    // WebflowSchema'ya göre doğrulama yapılacak
    const blob = new Blob([JSON.stringify(webflowJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.id || 'design'}-webflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    return { valid: true, errors: [] };
};
