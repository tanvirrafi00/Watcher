import React, { useEffect, useState } from 'react';
import './ErrorNotification.css';

export interface ErrorNotificationProps {
    message: string;
    type?: 'error' | 'warning' | 'info';
    duration?: number;
    onClose?: () => void;
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({
    message,
    type = 'error',
    duration = 5000,
    onClose,
}) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setVisible(false);
                onClose?.();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    if (!visible) {
        return null;
    }

    const getIcon = () => {
        switch (type) {
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'info':
                return 'ℹ️';
            default:
                return '❌';
        }
    };

    const handleClose = () => {
        setVisible(false);
        onClose?.();
    };

    return (
        <div className={`error-notification ${type}`}>
            <span className="error-icon">{getIcon()}</span>
            <span className="error-message">{message}</span>
            <button className="error-close" onClick={handleClose}>
                ✕
            </button>
        </div>
    );
};

export default ErrorNotification;
