import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenLine, Eraser, Undo2, Save, Loader2, MousePointer2, Palette, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { useLanguage } from '../context/LanguageContext';

interface StrokePoint { x: number; y: number }
interface Stroke {
    tool: 'pen' | 'eraser';
    size: number;
    color: string;
    points: StrokePoint[];
}

interface PaperCanvasProps {
    height?: string;
}

const SHARED_DRAWING_ID = '00000000-0000-0000-0000-000000000001';

const COLOR_PALETTE = [
    { name: 'Beyaz', value: '#E4EAE5' },
    { name: 'Kırmızı', value: '#EF4444' },
    { name: 'Mavi', value: '#3B82F6' },
    { name: 'Sarı', value: '#FACC15' },
    { name: 'Yeşil', value: '#22C55E' },
    { name: 'Turuncu', value: '#F97316' },
    { name: 'Mor', value: '#A855F7' },
    { name: 'Camgöbeği', value: '#22D3EE' }
];

export const PaperCanvas: React.FC<PaperCanvasProps> = React.memo(({ height = '100%' }) => {
    const { language } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const [tool, setTool] = useState<'none' | 'pen' | 'eraser'>('none');
    const [brushSize, setBrushSize] = useState(3);
    const [color, setColor] = useState(COLOR_PALETTE[0].value);
    const [panelOpen, setPanelOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedOk, setSavedOk] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const drawingRef = useRef(false);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        strokesRef.current.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 2) return;
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = stroke.size;
            if (stroke.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color || '#E4EAE5';
            }
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
    }, []);

    const loadDrawing = useCallback(async () => {
        if (!isSupabaseConfigured || !supabase) return;
        try {
            const { data, error } = await supabase
                .from('drawings')
                .select('data')
                .eq('id', SHARED_DRAWING_ID)
                .maybeSingle();
            if (error) {
                console.warn('[PaperCanvas] Load error:', error.message);
                return;
            }
            if (data && Array.isArray(data.data)) {
                strokesRef.current = data.data as Stroke[];
                requestAnimationFrame(redraw);
            }
        } catch (e) {
            console.warn('[PaperCanvas] Load exception:', e);
        }
    }, [redraw]);

    const saveDrawing = useCallback(async (silent = false) => {
        if (!isSupabaseConfigured || !supabase) {
            if (!silent) {
                setSavedAt(new Date().toLocaleTimeString());
                setSavedOk(true);
                setTimeout(() => setSavedOk(false), 1600);
            }
            return;
        }
        try {
            setSaving(true);
            const { data: sessionData } = await supabase.auth.getSession();
            const username = sessionData.session?.user?.user_metadata?.username
                ?? sessionData.session?.user?.email?.split('@')[0]
                ?? (language === 'tr' ? 'Misafir' : 'Guest');
            const payload = { id: SHARED_DRAWING_ID, username, data: strokesRef.current };
            const { error } = await supabase.from('drawings').upsert(payload, { onConflict: 'id' });
            if (error) {
                console.error('[PaperCanvas] Save error:', error.message);
                if (!silent) setSavedAt(language === 'tr' ? 'Kayıt hatası: ' + error.message : 'Save error: ' + error.message);
                return;
            }
            if (!silent) {
                setSavedAt(new Date().toLocaleTimeString());
                setSavedOk(true);
                setTimeout(() => setSavedOk(false), 1600);
            }
        } catch (e) {
            console.error('[PaperCanvas] Save exception:', e);
            if (!silent) setSavedAt(language === 'tr' ? 'Kayıt hatası' : 'Save error');
        } finally {
            setSaving(false);
        }
    }, [language]);

    // Real-time: listen for other people's drawings
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) return;
        loadDrawing();

        const channel = supabase
            .channel('paper-canvas-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'drawings', filter: `id=eq.${SHARED_DRAWING_ID}` }, (payload) => {
                const newData = (payload.new as any)?.data;
                if (Array.isArray(newData)) {
                    strokesRef.current = newData as Stroke[];
                    requestAnimationFrame(redraw);
                }
            })
            .subscribe();

        return () => { supabase?.removeChannel(channel); };
    }, [loadDrawing, redraw]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        resizeObserverRef.current = new ResizeObserver(() => { redraw(); });
        resizeObserverRef.current.observe(container);
        return () => { resizeObserverRef.current?.disconnect(); };
    }, [redraw]);

    const getPos = (e: React.PointerEvent): StrokePoint => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // True if the point is over the auth card (should NOT draw there)
    const isOverCard = useCallback((e: React.PointerEvent): boolean => {
        const card = document.querySelector<HTMLElement>('.sg-glass-card');
        if (!card) return false;
        const rect = card.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (tool === 'none') return;
        if (!canvasRef.current) return;
        if (isOverCard(e)) return;
        canvasRef.current.setPointerCapture(e.pointerId);
        drawingRef.current = true;
        currentStrokeRef.current = {
            tool,
            size: tool === 'eraser' ? brushSize * 3.5 : brushSize,
            color,
            points: [getPos(e)]
        };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!drawingRef.current || !currentStrokeRef.current) return;
        if (isOverCard(e)) return;
        currentStrokeRef.current.points.push(getPos(e));
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const stroke = currentStrokeRef.current;
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke.size;
        ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color;
        const pts = stroke.points;
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    };

    const handlePointerUp = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (currentStrokeRef.current) {
            strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
        }
        currentStrokeRef.current = null;
    };

    const handleUndo = () => {
        strokesRef.current = strokesRef.current.slice(0, -1);
        redraw();
    };

    const toolButtons = [
        { key: 'pen' as const, icon: <PenLine size={15} />, label: language === 'tr' ? 'Kalem' : 'Pen' },
        { key: 'eraser' as const, icon: <Eraser size={15} />, label: language === 'tr' ? 'Silgi' : 'Eraser' }
    ];

    // Cursor per tool: default mouse, round dot for pen (same size as stroke), round for eraser
    const eraserSize = brushSize * 3.5;
    const penDotSize = Math.max(brushSize, 4);
    const cursorStyle: React.CSSProperties = tool === 'pen'
        ? { cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${penDotSize + 4}' height='${penDotSize + 4}'><circle cx='${penDotSize / 2 + 2}' cy='${penDotSize / 2 + 2}' r='${penDotSize / 2}' fill='${color.replace('#', '%23')}' stroke='rgba(0,0,0,0.35)' stroke-width='1'/></svg>") ${penDotSize / 2 + 2} ${penDotSize / 2 + 2}, auto` }
        : tool === 'eraser'
            ? { cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${eraserSize + 4}' height='${eraserSize + 4}'><circle cx='${eraserSize / 2 + 2}' cy='${eraserSize / 2 + 2}' r='${eraserSize / 2}' fill='rgba(228,234,229,0.25)' stroke='%23E4EAE5' stroke-width='2'/></svg>") ${eraserSize / 2 + 2} ${eraserSize / 2 + 2}, auto` }
            : { cursor: 'default' };

    return (
        <div ref={containerRef} className="paper-canvas-wrap" style={{ height }}>
            <canvas
                ref={canvasRef}
                className="paper-canvas"
                style={cursorStyle}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />

            {/* FAB toggle: three dots -> X, toolbar opens above it */}
            <button
                type="button"
                className={`paper-fab ${panelOpen ? 'is-open' : ''}`}
                onClick={() => setPanelOpen(prev => !prev)}
                title={panelOpen ? (language === 'tr' ? 'Araçları Kapat' : 'Close Tools') : (language === 'tr' ? 'Çizim Araçları' : 'Drawing Tools')}
            >
                <span className={`paper-fab-dots ${panelOpen ? 'is-x' : ''}`}>
                    <i /><i /><i />
                </span>
            </button>

            {/* Color palette popup — floats above toolbar, never grows it */}
            {panelOpen && paletteOpen && (
                <div className="paper-color-popup">
                    {COLOR_PALETTE.map(c => (
                        <button
                            key={c.value}
                            type="button"
                            className={`paper-color-swatch ${color === c.value ? 'active' : ''}`}
                            style={{ background: c.value }}
                            onClick={() => { setColor(c.value); setTool('pen'); setPaletteOpen(false); }}
                            title={c.name}
                        />
                    ))}
                </div>
            )}

            {/* Expanded toolbar */}
            {panelOpen && (
                <div className="paper-toolbar">
                    <div className="paper-tool-row">
                        <div className="paper-tool-group">
                            <button
                                type="button"
                                className={`paper-tool-btn ${tool === 'none' ? 'active' : ''}`}
                                onClick={() => setTool('none')}
                                title={language === 'tr' ? 'İmleç' : 'Cursor'}
                            >
                                <MousePointer2 size={15} />
                            </button>
                            {toolButtons.map(btn => (
                                <button
                                    key={btn.key}
                                    type="button"
                                    className={`paper-tool-btn ${tool === btn.key ? 'active' : ''}`}
                                    onClick={() => setTool(btn.key)}
                                    title={btn.label}
                                >
                                    {btn.icon}
                                </button>
                            ))}
                        </div>
                        <div className="paper-tool-group">
                            <button type="button" className="paper-tool-btn" onClick={handleUndo} title={language === 'tr' ? 'Geri Al' : 'Undo'}>
                                <Undo2 size={15} />
                            </button>
                            <button type="button" className="paper-tool-btn paper-save-btn" onClick={() => saveDrawing(false)} disabled={saving} title={language === 'tr' ? 'Kaydet' : 'Save'}>
                                {saving
                                    ? <Loader2 size={15} className="paper-spin" />
                                    : savedOk
                                        ? <Check size={15} />
                                        : <Save size={15} />}
                            </button>
                        </div>
                    </div>
                    <div className="paper-tool-row">
                        <div className="paper-size-group">
                            <Palette size={12} style={{ color: 'var(--ink-60)', flexShrink: 0 }} />
                            <input
                                type="range"
                                min={2}
                                max={5}
                                step={1}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="paper-size-slider"
                                title={language === 'tr' ? 'Kalınlık' : 'Thickness'}
                            />
                            <span className="paper-size-val">{brushSize}</span>
                        </div>
                        <button
                            type="button"
                            className="paper-color-main"
                            style={{ background: color }}
                            onClick={() => setPaletteOpen(prev => !prev)}
                            title={COLOR_PALETTE.find(c => c.value === color)?.name ?? ''}
                        />
                    </div>
                </div>
            )}

            {savedAt && (
                <div className="paper-saved-hint">
                    {language === 'tr' ? 'Kaydedildi' : 'Saved'} · {savedAt}
                </div>
            )}
        </div>
    );
});

PaperCanvas.displayName = 'PaperCanvas';
