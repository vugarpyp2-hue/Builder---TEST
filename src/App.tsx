/**
 * @file App.tsx
 * @description Main application component.
 * @dependencies ./config/firebase.ts, ./types/index.ts, ./services/exportService.ts, ./config/constants.ts, ./utils/generateId.ts, ./components/shared/DottedGlowBackground.tsx, ./components/cards/ArtifactCard.tsx, ./components/drawers/SideDrawer.tsx, ./components/shared/Icons.tsx
 * @exports App
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Artifact, Session, ComponentVariation } from './types/index';
import { exportHtml, exportDesignPackage } from './services/exportService';
import { INITIAL_PLACEHOLDERS } from './config/constants';
import { generateId } from './utils/generateId';
import DottedGlowBackground from './components/shared/DottedGlowBackground';
import ArtifactCard from './components/cards/ArtifactCard';
import SideDrawer from './components/drawers/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowUpIcon, 
    GridIcon,
    TrashIcon,
    GoogleIcon,
    LogoutIcon,
    FigmaIcon,
    ResponsiveIcon
} from './components/shared/Icons';
import { auth, db, googleProvider } from './config/firebase';
import { 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    User 
} from 'firebase/auth';
import { 
    doc, 
    getDocFromServer,
} from 'firebase/firestore';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);
  const [isResponsiveView, setIsResponsiveView] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset responsive view when focus changes
  useEffect(() => {
    setIsResponsiveView(false);
  }, [focusedArtifactIndex]);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Test Connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if(error.message && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSessions([]);
      setCurrentSessionIndex(-1);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Dynamic placeholder generation on load
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const apiKey = process.env.API_KEY;
              if (!apiKey) return;
              const ai = new GoogleGenAI({ apiKey });
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: { 
                      role: 'user', 
                      parts: [{ 
                          text: 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.' 
                      }] 
                  }
              });
              const text = response.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const parseJsonStream = async function* (responseStream: AsyncGenerator<{ text: string }>) {
      let buffer = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text !== 'string') continue;
          buffer += text;
          let braceCount = 0;
          let start = buffer.indexOf('{');
          while (start !== -1) {
              braceCount = 0;
              let end = -1;
              for (let i = start; i < buffer.length; i++) {
                  if (buffer[i] === '{') braceCount++;
                  else if (buffer[i] === '}') braceCount--;
                  if (braceCount === 0 && i > start) {
                      end = i;
                      break;
                  }
              }
              if (end !== -1) {
                  const jsonString = buffer.substring(start, end + 1);
                  try {
                      yield JSON.parse(jsonString);
                      buffer = buffer.substring(end + 1);
                      start = buffer.indexOf('{');
                  } catch (e) {
                      start = buffer.indexOf('{', start + 1);
                  }
              } else {
                  break; 
              }
          }
      }
  };

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY is not configured.");
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
You are a master UI/UX designer. Generate 3 RADICAL CONCEPTUAL VARIATIONS of: "${currentSession.prompt}".

**STRICT IP SAFEGUARD:**
No names of artists. 
Instead, describe the *Physicality* and *Material Logic* of the UI.

**CREATIVE GUIDANCE (Use these as EXAMPLES of how to describe style, but INVENT YOUR OWN):**
1. Example: "Asymmetrical Primary Grid" (Heavy black strokes, rectilinear structure, flat primary pigments, high-contrast white space).
2. Example: "Suspended Kinetic Mobile" (Delicate wire-thin connections, floating organic primary shapes, slow-motion balance, white-void background).
3. Example: "Grainy Risograph Press" (Overprinted translucent inks, dithered grain textures, monochromatic color depth, raw paper substrate).
4. Example: "Volumetric Spectral Fluid" (Generative morphing gradients, soft-focus diffusion, bioluminescent light sources, spectral chromatic aberration).

**YOUR TASK:**
For EACH variation:
- Invent a unique design persona name based on a NEW physical metaphor.
- Rewrite the prompt to fully adopt that metaphor's visual language.
- Generate high-fidelity HTML/CSS.

Required JSON Output Format (stream ONE object per line):
{ "name": "Persona Name", "html": "..." }
        `.trim();

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
             contents: [{ parts: [{ text: prompt }], role: 'user' }],
             config: { temperature: 1.2 }
        });

        for await (const variation of parseJsonStream(responseStream)) {
            if (variation.name && variation.html) {
                setComponentVariations(prev => [...prev, variation]);
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ));
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  };

  const handleRefine = async (artifact: Artifact, refinement: string) => {
      const currentSession = sessions[currentSessionIndex];
      if (!currentSession) return;
      
      setSessions(prev => prev.map(sess => 
          sess.id === currentSession.id ? {
              ...sess,
              artifacts: sess.artifacts.map(art => 
                  art.id === artifact.id ? { ...art, status: 'streaming' } : art
              )
          } : sess
      ));
      
      const apiKey = process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
Here is an existing HTML page:
${artifact.html}

The user wants these changes: "${refinement}"

Apply ONLY the requested changes. Keep everything else identical.
Maintain all Client-First v2 class naming.
Return the complete updated HTML document.
`.trim();
      
      const responseStream = await ai.models.generateContentStream({
          model: 'gemini-3-flash-preview',
          contents: [{ parts: [{ text: prompt }], role: "user" }],
          config: { temperature: 0.6 }
      });
      
      let accumulatedHtml = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text === 'string') {
              accumulatedHtml += text;
              setSessions(prev => prev.map(sess => 
                  sess.id === currentSession.id ? {
                      ...sess,
                      artifacts: sess.artifacts.map(art => 
                          art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                      )
                  } : sess
              ));
          }
      }
      
      let finalHtml = accumulatedHtml.trim();
      if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
      if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
      if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();
      finalHtml = finalHtml.replace(/<img(?![^>]*\breferrerPolicy\b)/gi, '<img referrerPolicy="no-referrer"');

      setSessions(prev => prev.map(sess => 
          sess.id === currentSession.id ? {
              ...sess,
              artifacts: sess.artifacts.map(art => 
                  art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
              )
          } : sess
      ));
  };

  const handleRegenerate = async (artifact: Artifact) => {
      const currentSession = sessions[currentSessionIndex];
      if (!currentSession) return;
      
      // Find the style instruction for this artifact
      const styleInstruction = artifact.styleName;
      
      // Set status to streaming
      setSessions(prev => prev.map(sess => 
          sess.id === currentSession.id ? {
              ...sess,
              artifacts: sess.artifacts.map(art => 
                  art.id === artifact.id ? { ...art, html: '', status: 'streaming' } : art
              )
          } : sess
      ));
      
      // Re-generate
      const apiKey = process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
You are WOAVA UI — a professional-grade UI generation engine.
Your task: Create a complete, production-ready landing page for: "${currentSession.prompt}"

DESIGN DIRECTION: ${styleInstruction}

═══ MANDATORY OUTPUT RULES ═══

RULE 1 — CLIENT-FIRST v2 STRUCTURE (CRITICAL):
Every section MUST follow this exact nesting:

<section class="section_[name]">
  <div class="padding-global">
    <div class="container-large">
      <div class="[name]_component">
        <!-- Content goes here -->
      </div>
    </div>
  </div>
</section>

RULE 2 — CLASS NAMING:
- Component/custom classes: underscore separator → hero_heading, pricing_card, footer_link-list
- Utility classes: hyphen separator → text-size-xlarge, margin-bottom-large, padding-section-large
- NEVER use generic names like "div1", "section2", "wrapper"

RULE 3 — REQUIRED SECTIONS (generate ALL of these):
1. section_hero — Full-width hero with heading, subtext, and CTA button
2. section_features — 3-4 feature cards in a grid
3. section_about — About/description section
4. section_cta — Call-to-action banner
5. section_footer — Footer with links and copyright

RULE 4 — CSS RULES:
- All spacing in rem (0.25rem increments: 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8)
- Typography in rem (text sizes: 0.875, 1, 1.125, 1.25, 1.5, 2, 2.5, 3, 3.5, 4)
- Use CSS custom properties for colors:
  --color-primary, --color-secondary, --color-background, --color-text, --color-text-secondary, --color-border, --color-surface
- Define :root variables at the top of <style>
- Use Flexbox or Grid — NO float, NO absolute positioning for layout
- Include basic responsive: @media (max-width: 991px) and @media (max-width: 767px) and @media (max-width: 478px)
- Import Google Fonts via <link> in <head>

RULE 5 — HTML QUALITY:
- Use semantic tags: <section>, <header>, <nav>, <main>, <footer>, <article>, <h1>-<h6>, <p>, <a>, <button>
- Every <img> must have alt text and loading="lazy"
- Buttons use <button> or <a> tags, never <div>
- Links use <a> tags with href="#"
- Include proper <meta viewport> tag

RULE 6 — MATERIALITY (apply the design direction):
Translate the style direction "${styleInstruction}" into concrete CSS:
- Background textures, gradients, shadows
- Border styles and radius values
- Color palette that matches the metaphor
- Typography pairing (a display font + a body font from Google Fonts)
- Subtle hover transitions on interactive elements (0.3s ease)

OUTPUT FORMAT: Return ONLY the complete HTML document (<!DOCTYPE html> to </html>).
No markdown fences. No commentary. No explanation.
      `.trim();
      
      const responseStream = await ai.models.generateContentStream({
          model: 'gemini-3-flash-preview',
          contents: [{ parts: [{ text: prompt }], role: "user" }],
          config: { temperature: 0.6 }
      });
      
      let accumulatedHtml = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text === 'string') {
              accumulatedHtml += text;
              setSessions(prev => prev.map(sess => 
                  sess.id === currentSession.id ? {
                      ...sess,
                      artifacts: sess.artifacts.map(art => 
                          art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                      )
                  } : sess
              ));
          }
      }
      
      let finalHtml = accumulatedHtml.trim();
      if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
      if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
      if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();
      finalHtml = finalHtml.replace(/<img(?![^>]*\breferrerPolicy\b)/gi, '<img referrerPolicy="no-referrer"');

      setSessions(prev => prev.map(sess => 
          sess.id === currentSession.id ? {
              ...sess,
              artifacts: sess.artifacts.map(art => 
                  art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
              )
          } : sess
      ));
  };

  const handleClearHistory = async () => {
    if (window.confirm('Tüm geçmişi silmek istediğinize emin misiniz?')) {
        setSessions([]);
        setCurrentSessionIndex(-1);
        setFocusedArtifactIndex(null);
    }
  };
  
  // ... (rest of the state)

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!user) {
        setErrorMessage("Lütfen önce giriş yapın.");
        setTimeout(() => setErrorMessage(null), 3000);
        return;
    }

    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    
    try {
        const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Designing...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: baseTime,
        artifacts: placeholderArtifacts,
        userId: user?.uid || 'guest'
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY is not configured.");
        const ai = new GoogleGenAI({ apiKey });

        const stylePrompt = `
Generate 3 distinct, highly evocative design directions for: "${trimmedInput}".

**STRICT IP SAFEGUARD:**
Never use artist or brand names. Use physical and material metaphors.

**EXAMPLE OF GOOD OUTPUT:**
- Name: "Warm Terracotta Brutalism"
- Description: "Heavyweight slab-serif typography (DM Serif Display + Inter), warm earthy tones (#C4724A primary, #2C1810 text, #FAF3ED background), sharp 0px border-radius, thick 3px borders, generous whitespace with 4rem+ section padding, intentional misalignment for visual tension, paper-like texture overlays"

**GOAL:**
Return ONLY a raw JSON array of 3 *NEW*, creative names for these directions (e.g. ["Tactile Risograph Press", "Kinetic Silhouette Balance", "Primary Pigment Gridwork"]).
        `.trim();

        const styleResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { role: 'user', parts: [{ text: stylePrompt }] },
            config: { temperature: 0.9 }
        });

        let generatedStyles: string[] = [];
        const styleText = styleResponse.text || '[]';
        const jsonMatch = styleText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            try {
                generatedStyles = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Failed to parse styles, using fallbacks");
            }
        }

        if (!generatedStyles || generatedStyles.length < 3) {
            generatedStyles = [
                "Primary Pigment Gridwork",
                "Tactile Risograph Layering",
                "Kinetic Silhouette Balance"
            ];
        }
        
        generatedStyles = generatedStyles.slice(0, 3);

        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s,
                artifacts: s.artifacts.map((art, i) => ({
                    ...art,
                    styleName: generatedStyles[i]
                }))
            };
        }));

        const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
            try {
                const prompt = `
You are WOAVA UI — a professional-grade UI generation engine.
Your task: Create a complete, production-ready landing page for: "${trimmedInput}"

DESIGN DIRECTION: ${styleInstruction}

═══ MANDATORY OUTPUT RULES ═══

**VISUAL EXECUTION RULES:**
1. **Materiality**: Use the specified metaphor to drive every CSS choice. (e.g. if Risograph, use \`feTurbulence\` for grain and \`mix-blend-mode: multiply\` for ink layering).
2. **Typography**: Use high-quality web fonts. Pair a bold sans-serif with a refined monospace for data.
3. **Motion**: Include subtle, high-performance CSS/JS animations (hover transitions, entry reveals).
4. **IP SAFEGUARD**: No artist names or trademarks. 
5. **Webflow Client-First v2 Compatibility (MANDATORY)**: 
   - **Methodology**: Strictly follow Finsweet's Client-First v2 naming and structure.
   - **Naming Convention**: 
     - Use underscores (\`_\`) for components: \`header_component\`, \`card_item\`, \`contact_form\`.
     - Use hyphens (\`-\`) for utility classes: \`padding-global\`, \`container-large\`, \`margin-bottom-medium\`, \`text-size-large\`.
   - **Structural Hierarchy**: Every section MUST follow this nested structure:
     1. \`section_[name]\` (The outer section wrapper)
     2. \`padding-global\` (Global horizontal padding)
     3. \`container-[large/medium/small]\` (Max-width container)
     4. \`[name]_component\` (The actual content wrapper)
   - **Native Elements**: Map HTML tags to Webflow elements (section, div, h1-h6, p, button, a).
   - **Flexbox/Grid**: Use Flexbox or Grid for all layouts. **NO** absolute positioning for structure.
   - **Standard Units**: Use \`rem\` for typography and spacing, \`%\` or \`vw/vh\` for layouts.
   - **Clean CSS**: Ensure the CSS is modular and reflects the Client-First class structure.
   - **Full Page Structure**: Generate a COMPLETE page with Hero, Features, About, and Footer sections.

Return ONLY RAW HTML. No markdown fences.
          `.trim();
          
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-3-flash-preview',
                    contents: [{ parts: [{ text: prompt }], role: "user" }],
                    config: { temperature: 0.6 }
                });

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    const text = chunk.text;
                    if (typeof text === 'string') {
                        accumulatedHtml += text;
                        setSessions(prev => prev.map(sess => 
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art => 
                                    art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                )
                            } : sess
                        ));
                    }
                }
                
                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                // Add referrerPolicy="no-referrer" to all img tags
                finalHtml = finalHtml.replace(/<img(?![^>]*\breferrerPolicy\b)/gi, '<img referrerPolicy="no-referrer"');

                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                        )
                    } : sess
                ));

            } catch (e: any) {
                console.error('Error generating artifact:', e);
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`, status: 'error' } : art
                        )
                    } : sess
                ));
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));
        } catch (e) {
            console.error("Generation error:", e);
        }
    } catch (e: any) {
        console.error("Fatal error in generation process", e);
    } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, sessions.length, user]);

    const handleSurpriseMe = async () => {
      if (isLoading || !user) return;
      
      setIsLoading(true);
      
      try {
          const apiKey = process.env.API_KEY;
          if (!apiKey) throw new Error("API_KEY is not configured.");
          const ai = new GoogleGenAI({ apiKey });

          const surprisePrompt = `
Generate a highly creative and detailed landing page prompt for a modern, high-end web application. 
The category should be unique and professional (e.g., 'AI-Driven Bio-hacking Platform', 'Sustainable Orbital Tourism', 'Luxury Minimalist Furniture', 'Next-Gen Quantum Computing SaaS').

The generated prompt MUST explicitly request:
- A COMPLETE, full-page landing page layout.
- Multiple distinct sections (Hero, Features, How it Works, Pricing, Testimonials, FAQ, and Footer).
- High-end visual directives (e.g., glassmorphism, bento grids, sophisticated typography, smooth motion).
- **Webflow-Native Structure**: Use semantic HTML, Flexbox/Grid layouts, and clear BEM-style class names for easy import into Webflow.

Return ONLY the prompt text, no extra commentary.
          `.trim();

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: { role: 'user', parts: [{ text: surprisePrompt }] }
          });

          const generatedPrompt = response.text?.trim() || placeholders[placeholderIndex];
          setInputValue(generatedPrompt);
          handleSendMessage(generatedPrompt);
      } catch (error) {
          console.error("Surprise Me failed:", error);
          const fallback = placeholders[placeholderIndex];
          setInputValue(fallback);
          handleSendMessage(fallback);
      } finally {
          setIsLoading(false);
      }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    } else if (event.key === 'Tab' && !inputValue && !isLoading) {
        event.preventDefault();
        setInputValue(placeholders[placeholderIndex]);
    }
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  return (
    <>
        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <ThinkingIcon /> 
                     Designing variations...
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'variations' && (
                <div className="sexy-grid">
                    {componentVariations.map((v, i) => (
                         <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                             <div className="sexy-preview">
                                 <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                             </div>
                             <div className="sexy-label">{v.name}</div>
                         </div>
                    ))}
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <div className="auth-controls">
                {user ? (
                    <div className="user-profile">
                        <img src={user.photoURL || ''} alt={user.displayName || ''} className="user-avatar" referrerPolicy="no-referrer" />
                        <button className="auth-btn logout" onClick={handleLogout} title="Çıkış Yap">
                            <LogoutIcon />
                        </button>
                    </div>
                ) : (
                    <button className="auth-btn login" onClick={handleLogin}>
                        <GoogleIcon /> Google ile Oturum Açın
                    </button>
                )}
            </div>

            {sessions.length > 0 && (
                <button className="clear-history-btn" onClick={handleClearHistory} title="Geçmişi Temizle">
                    <TrashIcon />
                </button>
            )}
            <DottedGlowBackground 
                gap={32} 
                radius={1.2} 
                color="rgba(255, 255, 255, 0.02)" 
                glowColor="rgba(255, 255, 255, 0.12)" 
                speedScale={0.4} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>WOAVA UI</h1>
                         <p>Professional UI generation at scale</p>
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                             <SparklesIcon /> Surprise Me
                         </button>
                     </div>
                 </div>

                {sessions.map((session, sIndex) => {
                    // Performance optimization: only render the current session
                    if (sIndex !== currentSessionIndex) return null;
                    
                    const positionClass = 'active-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {session.artifacts.map((artifact, aIndex) => {
                                    const isFocused = sIndex === currentSessionIndex && focusedArtifactIndex === aIndex;
                                    
                                    return (
                                        <ArtifactCard 
                                            key={artifact.id}
                                            artifact={artifact}
                                            isFocused={isFocused}
                                            isResponsiveView={isResponsiveView}
                                            onClick={() => setFocusedArtifactIndex(aIndex)}
                                            onRefine={(refinement) => handleRefine(artifact, refinement)}
                                            onRegenerate={() => handleRegenerate(artifact)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                    <ArrowRightIcon />
                </button>
             )}

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''} ${isResponsiveView ? 'responsive-active' : ''}`}>
                 <div className="active-prompt-label">
                    {currentSession?.prompt}
                 </div>
                 <div className="action-buttons">
                    <button onClick={() => {
                        setFocusedArtifactIndex(null);
                        setIsResponsiveView(false);
                    }} className="grid-btn">
                        <GridIcon /> Grid View
                    </button>
                    <button 
                        onClick={() => setIsResponsiveView(!isResponsiveView)} 
                        className={`responsive-btn ${isResponsiveView ? 'active' : ''}`}
                        title="Responsive View"
                    >
                        <ResponsiveIcon /> Responsive
                    </button>
                    <button onClick={handleGenerateVariations} disabled={isLoading} className="variations-btn">
                        <SparklesIcon /> Variations
                    </button>
                    <button onClick={handleShowCode} className="source-btn">
                        <CodeIcon /> Source
                    </button>
                    <button onClick={() => {
                        const artifact = sessions[currentSessionIndex].artifacts[focusedArtifactIndex!];
                        exportHtml(artifact.html, `woava-export-${Date.now()}`);
                    }} className="export-btn">
                        <CodeIcon /> HTML Export
                    </button>
                    <button onClick={async () => {
                        const artifact = sessions[currentSessionIndex].artifacts[focusedArtifactIndex!];
                        await exportDesignPackage(artifact.html, `woava-design-${Date.now()}`);
                    }} className="package-btn">
                        <FigmaIcon /> Design Package
                    </button>
                 </div>
            </div>

            <div className="floating-input-container">
                {errorMessage && (
                    <div className="error-message-toast">
                        {errorMessage}
                    </div>
                )}
                <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                    {(!inputValue && !isLoading) && (
                        <div className="animated-placeholder" key={placeholderIndex}>
                            <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                            <span className="tab-hint">Tab</span>
                        </div>
                    )}
                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={inputValue} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                            disabled={isLoading} 
                        />
                    ) : (
                        <div className="input-generating-label">
                            <span className="generating-prompt-text">{currentSession?.prompt}</span>
                            <ThinkingIcon />
                        </div>
                    )}
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                        <ArrowUpIcon />
                    </button>
                </div>
            </div>
        </div>
    </>
  );
}

export default App;
