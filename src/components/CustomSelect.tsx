import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    id?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    id,
    options,
    value,
    onChange,
    placeholder = 'Select option...',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div 
            id={id} 
            ref={containerRef} 
            className={`custom-select-container ${className}`}
        >
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="custom-select-trigger"
            >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.7, flexShrink: 0, marginLeft: '0.5rem' }} />
            </button>
            
            {isOpen && (
                <div className="custom-select-dropdown">
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
                                >
                                    {opt.label}
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    );
};

CustomSelect.displayName = 'CustomSelect';
