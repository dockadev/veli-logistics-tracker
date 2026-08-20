import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    isStale?: boolean;
}

interface CustomSelectProps {
    id?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    id,
    options,
    value,
    onChange,
    placeholder = 'Select option...',
    className = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const measure = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setPos(null);
    }, []);

    const toggle = useCallback(() => {
        if (disabled) return;
        if (!isOpen) {
            measure();
            setIsOpen(true);
        } else {
            close();
        }
    }, [isOpen, disabled, measure, close]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen) return;
            const target = event.target as Node;
            if (
                containerRef.current?.contains(target) ||
                dropdownRef.current?.contains(target)
            ) {
                return;
            }
            close();
        };
        const handleScroll = () => {
            if (isOpen) close();
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) close();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        window.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
            window.removeEventListener('keydown', handleKey);
        };
    }, [isOpen, close]);

    const handleSelect = (val: string) => {
        onChange(val);
        close();
    };

    const isWideHeader = className.includes('header-depot-select');

    const dropdown = (
        <div
            ref={dropdownRef}
            className={`custom-select-dropdown ${className}`.trim()}
            style={{
                position: 'fixed',
                top: pos ? pos.top : 0,
                left: pos ? pos.left : 0,
                width: pos ? (isWideHeader ? 'max-content' : pos.width) : 200,
                minWidth: pos ? pos.width : 200,
                zIndex: 2147483000
            }}
        >
            {options.length === 0 ? (
                <div style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                    No options available
                </div>
            ) : (
                options.map(opt => {
                    const isSelected = opt.value === value;
                    return (
                        <div
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                            style={opt.isStale ? { color: '#ef4444' } : undefined}
                        >
                            {opt.label}
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div
            id={id}
            ref={containerRef}
            className={`custom-select-container ${isOpen ? 'open' : ''} ${className}`.trim()}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                className="custom-select-trigger"
                disabled={disabled}
                style={disabled ? { opacity: 0.55, cursor: 'not-allowed', background: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)' } : undefined}
            >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: selectedOption?.isStale ? '#ef4444' : undefined }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.7, flexShrink: 0, marginLeft: '0.5rem' }} />
            </button>

            {isOpen && pos && createPortal(dropdown, document.body)}
        </div>
    );
};

CustomSelect.displayName = 'CustomSelect';
