import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, MessageCircle, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

interface ChatMessage {
    id: string;
    username: string;
    clan: string | null;
    message: string;
    created_at: string;
}

interface CoalitionChatProps {
    currentUsername: string | null;
    userClan: string | null;
    theme: 'dark' | 'light';
    userRole: string | null;
    showToast?: (message: string, type: 'success' | 'info' | 'error' | 'warning') => void;
    isFullTab?: boolean;
    isFloatingOnly?: boolean;
    isChatOpen?: boolean;
    onUnreadChange?: (count: number) => void;
    onClose?: () => void;
    style?: React.CSSProperties;
}

export const CoalitionChat: React.FC<CoalitionChatProps> = React.memo(({ currentUsername, userClan, theme, userRole, showToast, isFullTab, isFloatingOnly, isChatOpen = false, onUnreadChange, onClose, style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isChatOpenRef = useRef(isChatOpen);
    useEffect(() => {
        isChatOpenRef.current = isChatOpen;
    }, [isChatOpen]);

    // Reset unread count when chat is opened
    useEffect(() => {
        if (isChatOpen) {
            setUnreadCount(0);
            if (onUnreadChange) onUnreadChange(0);
            scrollToBottom();
        }
    }, [isChatOpen, onUnreadChange]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // When unreadCount changes, notify parent
    useEffect(() => {
        if (onUnreadChange) {
            onUnreadChange(unreadCount);
        }
    }, [unreadCount, onUnreadChange]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [position, setPosition] = useState({ x: 88, y: 150 });
    const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

    useEffect(() => {
        if (isFloatingOnly) {
            const initialY = Math.max(20, Math.round(window.innerHeight * 0.35 - 230));
            setPosition({ x: 88, y: initialY });
        }
    }, [isFloatingOnly]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isFloatingOnly) return;
        if (e.button !== 0) return;
        
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }

        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            posX: position.x,
            posY: position.y
        };

        const handleMouseMove = (ev: MouseEvent) => {
            if (!dragStartRef.current) return;
            const deltaX = ev.clientX - dragStartRef.current.startX;
            const deltaY = ev.clientY - dragStartRef.current.startY;
            
            let newX = dragStartRef.current.posX + deltaX;
            let newY = dragStartRef.current.posY + deltaY;

            const maxX = window.innerWidth - 380;
            const maxY = window.innerHeight - 80;
            newX = Math.max(10, Math.min(newX, maxX));
            newY = Math.max(10, Math.min(newY, maxY));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            dragStartRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        e.preventDefault();
    };

    // Load initial messages
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) {
            // Mock messages fallback
            setMessages([
                {
                    id: 'mock-1',
                    username: 'LogiKnight_33',
                    clan: 'PARS',
                    message: 'Brodytown seaport needs iron crates asap!',
                    created_at: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 'mock-2',
                    username: 'FrontlinePioneer',
                    clan: 'UBGE',
                    message: 'We are bringing 2 flatbeds of supply crates.',
                    created_at: new Date(Date.now() - 1800000).toISOString()
                }
            ]);
            return;
        }

        const fetchMessages = async () => {
            if (!supabase) return;
            try {
                const { data, error } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(50);
                
                if (error) {
                    console.error('[Chat] Failed to load messages:', error);
                } else if (data) {
                    setMessages(data);
                }
            } catch (err) {
                console.error('[Chat] Load error:', err);
            }
        };

        fetchMessages();
    }, []);

    // Subscribe to real-time chat messages
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) return;

        const chatChannel = supabase
            .channel('public-chat-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                (payload) => {
                    console.log('[Chat Real-time] Message received:', payload);
                    const newMsg = payload.new as ChatMessage;
                    
                    setMessages(prev => {
                        const exists = prev.some(m => m.id === newMsg.id);
                        if (exists) return prev;
                        return [...prev, newMsg];
                    });

                    // Increment unread count if chat panel is closed
                    if (!isChatOpenRef.current) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'chat_messages' },
                async (payload) => {
                    console.log('[Chat Real-time] Message deleted:', payload);
                    if (payload.old && payload.old.id) {
                        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                    } else {
                        // Refetch current messages from db to ensure absolute sync after bulk delete
                        if (isSupabaseConfigured && supabase) {
                            try {
                                const { data } = await supabase
                                    .from('chat_messages')
                                    .select('*')
                                    .order('created_at', { ascending: true })
                                    .limit(50);
                                if (data) {
                                    setMessages(data);
                                } else {
                                    setMessages([]);
                                }
                            } catch (e) {
                                console.error('[Chat Real-time] Failed to sync messages after delete:', e);
                                setMessages([]);
                            }
                        } else {
                            setMessages([]);
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Chat Real-time] Channel status:', status);
            });

        return () => {
            if (supabase) {
                supabase.removeChannel(chatChannel);
            }
        };
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text) return;

        if (text.toLowerCase() === '/clear' || text.toLowerCase() === '/clean') {
            if (userRole === 'developer') {
                setShowClearConfirm(true);
                setNewMessage('');
                return;
            } else {
                if (showToast) {
                    showToast("Sohbeti temizlemek için geliştirici (developer) yetkiniz olmalıdır.", "error");
                } else {
                    alert("Sohbeti temizlemek için geliştirici (developer) yetkiniz olmalıdır.");
                }
                setNewMessage('');
                return;
            }
        }

        const displayName = currentUsername || 'LogiMember';

        if (isSupabaseConfigured && supabase) {
            try {
                const msgId = crypto.randomUUID();
                const localMsg: ChatMessage = {
                    id: msgId,
                    username: displayName,
                    clan: userClan,
                    message: text,
                    created_at: new Date().toISOString()
                };
                setMessages(prev => [...prev, localMsg]);

                const { error } = await supabase
                    .from('chat_messages')
                    .insert({
                        id: msgId,
                        username: displayName,
                        clan: userClan,
                        message: text
                    });
                if (error) {
                    console.error('[Chat] Send failed:', error);
                }
            } catch (err) {
                console.error('[Chat] Error sending message:', err);
            }
        } else {
            const localMsg: ChatMessage = {
                id: 'local-' + Date.now(),
                username: displayName,
                clan: userClan,
                message: text,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, localMsg]);

            // Simulate quick replies in offline mode
            setTimeout(() => {
                const responses = [
                    "Copy that, coordinate delivery immediately.",
                    "Seaport stocks updated.",
                    "Understood. Continuing supply runs.",
                    "Active requests board is synced."
                ];
                const mockReply: ChatMessage = {
                    id: 'mock-reply-' + Date.now(),
                    username: 'AutoLogi',
                    clan: 'PARS',
                    message: responses[Math.floor(Math.random() * responses.length)],
                    created_at: new Date().toISOString()
                };
                setMessages(prev => [...prev, mockReply]);
                if (!isChatOpenRef.current) {
                    setUnreadCount(prev => prev + 1);
                }
            }, 2000);
        }

        setNewMessage('');
    };

    const handleClearChat = () => {
        setShowClearConfirm(true);
    };

    const confirmClearChat = async () => {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('chat_messages')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) {
                    console.error('[Chat] Clear failed:', error);
                } else {
                    setMessages([]);
                    if (showToast) showToast("Sohbet geçmişi başarıyla temizlendi.", "info");
                }
            } catch (err) {
                console.error('[Chat] Error clearing chat:', err);
            }
        } else {
            setMessages([]);
            if (showToast) showToast("Sohbet geçmişi başarıyla temizlendi (Yerel).", "info");
        }
    };

    const isDark = theme === 'dark';
    const buttonBg = isDark ? '#ffffff' : '#f97316';
    const iconColor = isDark ? '#000000' : '#ffffff';

    return (
        <>
            {isFullTab || isFloatingOnly ? (
                <div 
                    ref={chatContainerRef}
                    className={`chat-panel-container ${isFloatingOnly ? 'chat-popup-anim' : ''}`}
                    style={{
                        position: isFloatingOnly ? 'fixed' : 'relative',
                        left: isFloatingOnly ? `${position.x}px` : undefined,
                        top: isFloatingOnly ? `${position.y}px` : undefined,
                        transform: undefined,
                        width: isFloatingOnly ? '360px' : '100%',
                        height: isFloatingOnly ? '460px' : '100%',
                        minHeight: isFloatingOnly ? undefined : '600px',
                        background: theme === 'dark' ? '#0f0f18' : '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: isFloatingOnly ? '0 8px 32px rgba(0, 0, 0, 0.8)' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: isFloatingOnly ? 9999 : undefined,
                        ...style
                    }}
                >
                    {showClearConfirm && (
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(15, 15, 20, 0.95)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 10000,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '1.5rem',
                            textAlign: 'center'
                        }}>
                            <Trash2 size={32} style={{ color: '#ff4757', marginBottom: '0.8rem' }} />
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Sohbeti Temizle
                            </h4>
                            <p style={{ margin: '0 0 1.2rem 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                Sohbet geçmişini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                <button 
                                    type="button"
                                    className="btn btn-secondary" 
                                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
                                    onClick={() => setShowClearConfirm(false)}
                                >
                                    İptal
                                </button>
                                <button 
                                    type="button"
                                    className="btn" 
                                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', background: '#ff4757', border: 'none', color: '#fff', fontWeight: 600 }}
                                    onClick={() => {
                                        confirmClearChat();
                                        setShowClearConfirm(false);
                                    }}
                                >
                                    Temizle
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Header */}
                    <div 
                        onMouseDown={handleMouseDown}
                        style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.2)',
                            cursor: isFloatingOnly ? 'move' : 'default',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MessageSquare size={16} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>
                                Coalition Chat
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {userRole === 'developer' && (
                                <button 
                                    type="button"
                                    onClick={handleClearChat}
                                    title="Sohbeti Temizle"
                                    style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                            {isFloatingOnly && onClose && (
                                <button 
                                    type="button"
                                    onClick={onClose}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                    aria-label="Close chat"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Messages Body */}
                    <div 
                        style={{
                            flexGrow: 1,
                            overflowY: 'auto',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem'
                        }}
                    >
                        {messages.length === 0 ? (
                            <div style={{ textAlign: 'center', margin: 'auto', opacity: 0.4, fontSize: '0.75rem' }}>
                                No messages in chat.
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isSelf = msg.username === currentUsername;
                                const isConsecutive = index > 0 && messages[index - 1].username === msg.username;
                                return (
                                    <div 
                                        key={msg.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isSelf ? 'flex-end' : 'flex-start',
                                            maxWidth: '85%',
                                            alignSelf: isSelf ? 'flex-end' : 'flex-start',
                                            marginTop: isConsecutive ? '-0.25rem' : '0.25rem'
                                        }}
                                    >
                                        {!isConsecutive && (
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.05rem', fontWeight: 600 }}>
                                                {msg.clan ? `[${msg.clan}] ` : ''}{msg.username}
                                            </span>
                                        )}
                                        <div 
                                            style={{
                                                padding: '0.35rem 0.6rem',
                                                borderRadius: isSelf 
                                                    ? (isConsecutive ? '12px' : '12px 12px 2px 12px') 
                                                    : (isConsecutive ? '12px' : '12px 12px 12px 2px'),
                                                background: isSelf ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                border: isSelf ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)',
                                                fontSize: '0.75rem',
                                                color: '#fff',
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {msg.message}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer Input Form */}
                    <form 
                        onSubmit={handleSendMessage}
                        style={{
                            padding: '0.75rem',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex',
                            gap: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.2)'
                        }}
                    >
                        <input 
                            type="text" 
                            className="gate-input-field"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type message..."
                            style={{
                                flexGrow: 1,
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--border-color)',
                                color: '#fff',
                                outline: 'none'
                            }}
                            required
                        />
                        <button 
                            type="submit"
                            style={{
                                background: buttonBg,
                                color: iconColor,
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <Send size={14} style={{ margin: 'auto' }} />
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    {/* Floating Chat Trigger Button */}
                    <button 
                        type="button" 
                        className="chat-floating-btn"
                        onClick={() => setIsOpen(!isOpen)}
                        style={{
                            position: 'fixed',
                            bottom: '1.5rem',
                            right: '1.5rem',
                            zIndex: 9999,
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: buttonBg,
                            color: iconColor,
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isDark ? '0 4px 16px rgba(255, 255, 255, 0.15)' : '0 4px 16px rgba(249, 115, 22, 0.4)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <MessageCircle size={22} />
                        {unreadCount > 0 && (
                            <span 
                                style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    right: '-5px',
                                    background: '#f43f5e',
                                    color: '#fff',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    borderRadius: '10px',
                                    padding: '2px 6px',
                                    border: '2px solid rgba(15, 15, 20, 0.85)'
                                }}
                            >
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Chat Panel */}
                    {isOpen && (
                        <div 
                            ref={chatContainerRef}
                            className="chat-panel-container anim-fade-in"
                            style={{
                                position: 'fixed',
                                bottom: '5rem',
                                right: '1.5rem',
                                width: '360px',
                                height: '460px',
                                background: theme === 'dark' ? '#000000' : '#ffffff',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                                display: 'flex',
                                flexDirection: 'column',
                                zIndex: 9999,
                                overflow: 'hidden'
                            }}
                        >
                            {showClearConfirm && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(15, 15, 20, 0.95)',
                                    backdropFilter: 'blur(8px)',
                                    zIndex: 10000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: '1.5rem',
                                    textAlign: 'center'
                                }}>
                                    <Trash2 size={32} style={{ color: '#ff4757', marginBottom: '0.8rem' }} />
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Sohbeti Temizle
                                    </h4>
                                    <p style={{ margin: '0 0 1.2rem 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                        Sohbet geçmişini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                        <button 
                                            type="button"
                                            className="btn btn-secondary" 
                                            style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
                                            onClick={() => setShowClearConfirm(false)}
                                        >
                                            İptal
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn" 
                                            style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', background: '#ff4757', border: 'none', color: '#fff', fontWeight: 600 }}
                                            onClick={() => {
                                                confirmClearChat();
                                                setShowClearConfirm(false);
                                            }}
                                        >
                                            Temizle
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Header */}
                            <div 
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: theme === 'dark' ? '#000000' : 'rgba(0, 0, 0, 0.02)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MessageSquare size={16} style={{ color: 'var(--accent-color)' }} />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>
                                        Coalition Chat
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    {userRole === 'developer' && (
                                        <button 
                                            type="button"
                                            onClick={handleClearChat}
                                            title="Sohbeti Temizle"
                                            style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Body */}
                            <div 
                                style={{
                                    flexGrow: 1,
                                    overflowY: 'auto',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.45rem'
                                }}
                            >
                                {messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', margin: 'auto', opacity: 0.4, fontSize: '0.75rem' }}>
                                        No messages in chat.
                                    </div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isSelf = msg.username === currentUsername;
                                        const isConsecutive = index > 0 && messages[index - 1].username === msg.username;
                                        return (
                                            <div 
                                                key={msg.id}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: isSelf ? 'flex-end' : 'flex-start',
                                                    maxWidth: '85%',
                                                    alignSelf: isSelf ? 'flex-end' : 'flex-start',
                                                    marginTop: isConsecutive ? '-0.25rem' : '0.25rem'
                                                }}
                                            >
                                                {!isConsecutive && (
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.05rem', fontWeight: 600 }}>
                                                        {msg.clan ? `[${msg.clan}] ` : ''}{msg.username}
                                                    </span>
                                                )}
                                                <div 
                                                    style={{
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: isSelf 
                                                            ? (isConsecutive ? '12px' : '12px 12px 2px 12px') 
                                                            : (isConsecutive ? '12px' : '12px 12px 12px 2px'),
                                                        background: isSelf ? 'rgba(249, 115, 22, 0.15)' : (theme === 'dark' ? '#111111' : 'rgba(0, 0, 0, 0.04)'),
                                                        border: isSelf ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-primary)',
                                                        wordBreak: 'break-word'
                                                    }}
                                                >
                                                    {msg.message}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Footer Input Form */}
                            <form 
                                onSubmit={handleSendMessage}
                                style={{
                                    padding: '0.75rem',
                                    borderTop: '1px solid var(--border-color)',
                                    display: 'flex',
                                    gap: '0.5rem',
                                    background: theme === 'dark' ? '#000000' : 'rgba(0, 0, 0, 0.02)'
                                }}
                            >
                                <input 
                                    type="text" 
                                    className="gate-input-field"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type message..."
                                    style={{
                                        flexGrow: 1,
                                        padding: '0.4rem 0.75rem',
                                        fontSize: '0.75rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: theme === 'dark' ? '#0a0a0a' : 'var(--input-bg)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)',
                                        outline: 'none'
                                    }}
                                    required
                                    autoComplete="off"
                                />
                                <button 
                                    type="submit"
                                    style={{
                                        background: buttonBg,
                                        color: iconColor,
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Send size={14} style={{ margin: 'auto' }} />
                                </button>
                            </form>
                        </div>
                    )}
                </>
            )}
        </>
    );
});

CoalitionChat.displayName = 'CoalitionChat';
