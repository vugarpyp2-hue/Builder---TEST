/**
 * @file ArtifactCard.tsx
 * @description Displays a single artifact with responsive preview and refinement options.
 * @dependencies ../../types/index.ts, ../shared/Icons.tsx
 * @exports ArtifactCard
 */

import React, { useEffect, useRef, useState } from 'react';
import { Artifact } from '../../types/index';
import { SmartphoneIcon, TabletIcon, MonitorIcon, LayoutGridIcon } from '../shared/Icons';
import { exportToWebflow } from '../../services/exportService';

interface ArtifactCardProps {
    key?: string | number;
    artifact: Artifact;
    isFocused: boolean;
    isResponsiveView: boolean;
    onClick: () => void;
    onRefine: (refinement: string) => void | Promise<void>;
    onRegenerate: () => void | Promise<void>;
}

const ArtifactCard = ({ 
    artifact, 
    isFocused, 
    isResponsiveView,
    onClick,
    onRefine,
    onRegenerate
}: ArtifactCardProps) => {
    const [refinement, setRefinement] = useState('');
    const codeRef = useRef<HTMLPreElement>(null);
    const [activeDevice, setActiveDevice] = useState<'all' | 'mobile' | 'tablet' | 'desktop'>('all');
    const [exportProgress, setExportProgress] = useState<{ active: boolean; progress: number; status: string } | null>(null);

    // Auto-scroll logic for this specific card
    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [artifact.html]);

    const isBlurring = artifact.status === 'streaming';

    const handleWebflowExport = async () => {
        setExportProgress({ active: true, progress: 0, status: 'Başlatılıyor...' });
        
        // Simulate progress steps
        const steps = [
            { p: 20, s: 'Tasarım yapısı analiz ediliyor...' },
            { p: 40, s: 'Stiller ve değişkenler hazırlanıyor...' },
            { p: 60, s: 'Varlıklar (assets) paketleniyor...' },
            { p: 80, s: 'JSON yapısı doğrulanıyor...' },
            { p: 100, s: 'İndirme başlatılıyor...' }
        ];

        for (const step of steps) {
            await new Promise(r => setTimeout(r, 600));
            setExportProgress({ active: true, progress: step.p, status: step.s });
        }

        const result = await exportToWebflow(artifact);
        
        if (!result.valid) {
            console.error("Export validation failed:", result.errors);
            setExportProgress({ active: true, progress: 0, status: 'Hata: ' + result.errors[0] });
            setTimeout(() => setExportProgress(null), 3000);
        } else {
            setExportProgress({ active: true, progress: 100, status: 'Tamamlandı!' });
            setTimeout(() => setExportProgress(null), 1500);
        }
    };

    return (
        <div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isResponsiveView ? 'responsive-mode' : ''} ${isBlurring ? 'generating' : ''}`}
            onClick={onClick}
        >
            {exportProgress?.active && (
                <div className="export-progress-overlay">
                    <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${exportProgress.progress}%` }} />
                    </div>
                    <p className="progress-status">{exportProgress.status}</p>
                </div>
            )}
            {isFocused && isResponsiveView ? (
                <div className="responsive-container">
                    <div className="responsive-controls">
                        <button 
                            className={`control-btn ${activeDevice === 'all' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setActiveDevice('all'); }}
                        >
                            <LayoutGridIcon size={14} />
                            <span>All</span>
                        </button>
                        <div className="control-divider" />
                        <button 
                            className={`control-btn ${activeDevice === 'mobile' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setActiveDevice('mobile'); }}
                        >
                            <SmartphoneIcon size={14} />
                            <span>iPhone</span>
                        </button>
                        <button 
                            className={`control-btn ${activeDevice === 'tablet' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setActiveDevice('tablet'); }}
                        >
                            <TabletIcon size={14} />
                            <span>iPad</span>
                        </button>
                        <button 
                            className={`control-btn ${activeDevice === 'desktop' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setActiveDevice('desktop'); }}
                        >
                            <MonitorIcon size={14} />
                            <span>Desktop</span>
                        </button>
                    </div>

                    <div className={`responsive-viewport ${activeDevice !== 'all' ? 'single-device' : ''}`}>
                        {(activeDevice === 'all' || activeDevice === 'mobile') && (
                            <div className="device-wrapper">
                                <div className="device-label">Mobile <span>375 × 667</span></div>
                                <div className="device-frame mobile">
                                    <iframe srcDoc={artifact.html} title="mobile" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin" />
                                </div>
                            </div>
                        )}
                        {(activeDevice === 'all' || activeDevice === 'tablet') && (
                            <div className="device-wrapper">
                                <div className="device-label">Tablet <span>768 × 1024</span></div>
                                <div className="device-frame tablet">
                                    <iframe srcDoc={artifact.html} title="tablet" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin" />
                                </div>
                            </div>
                        )}
                        {(activeDevice === 'all' || activeDevice === 'desktop') && (
                            <div className="device-wrapper desktop-wrapper">
                                <div className="device-label">Desktop <span>1280 × 800</span></div>
                                <div className="device-frame desktop">
                                    <iframe srcDoc={artifact.html} title="desktop" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="artifact-header">
                        <span className="artifact-style-tag">{artifact.styleName}</span>
                        <div className="artifact-controls">
                            <button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} title="Regenerate">
                                ↻
                            </button>
                            <button onClick={(e) => { 
                                e.stopPropagation(); 
                                handleWebflowExport();
                            }} title="Export to Webflow">
                                ↗ Webflow
                            </button>
                        </div>
                    </div>
                    <div className="artifact-card-inner">
                        {isBlurring ? (
                            <div className="generating-overlay">
                                <pre ref={codeRef} className="code-stream-preview">
                                    {artifact.html}
                                </pre>
                            </div>
                        ) : (
                            <iframe 
                                srcDoc={artifact.html} 
                                title={artifact.id} 
                                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                                className="artifact-iframe"
                            />
                        )}
                        {isFocused && (
                            <div className="refine-container">
                                <input 
                                    type="text" 
                                    placeholder="Describe changes..." 
                                    value={refinement}
                                    onChange={(e) => setRefinement(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <button onClick={(e) => { e.stopPropagation(); onRefine(refinement); setRefinement(''); }}>Send</button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ArtifactCard;
