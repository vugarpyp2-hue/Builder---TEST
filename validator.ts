export interface ValidationResult {
    score: number;
    issues: string[];
    passed: boolean;
}

export function validateClientFirst(html: string): ValidationResult {
    const issues: string[] = [];
    let score = 100;

    // 1. Check for section_ classes
    const sectionMatches = (html.match(/class="section_[^"]*"/g) || []).length;
    if (sectionMatches < 3) {
        issues.push(`Too few sections found: ${sectionMatches}. Expected at least 3.`);
        score -= 20;
    }

    // 2. Check for nested structure
    if (!html.includes('padding-global') || !html.includes('container-large')) {
        issues.push('Missing required Client-First nesting classes (padding-global or container-large).');
        score -= 30;
    }

    // 3. Check for absolute positioning
    if (html.includes('position: absolute') || html.includes('position: fixed')) {
        issues.push('Warning: Absolute or fixed positioning detected. This may break Webflow layout.');
        score -= 10;
    }

    // 4. Check for CSS variables
    if (!html.includes('--color-')) {
        issues.push('Missing CSS custom properties for colors.');
        score -= 20;
    }

    return {
        score: Math.max(0, score),
        issues,
        passed: score >= 80
    };
}
