import React, { useState, useCallback } from 'react';
import ErrorNotification, { ErrorNotificationProps } from './ErrorNotification';

export interface Notification extends Omit<ErrorNotificationProps, 'onClose'> {
    id: string;
}

interface NotificationManagerProps {
    children: (showNotification: (notification: Omit<Notification, 'id'>) => void) => React.ReactNode;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = `notification-${Date.now()}-${Math.random()}`;
        const newNotification: Notification = { ...notification, id };

        setNotifications(prev => [...prev, newNotification]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <>
            {children(showNotification)}
            <div className="notification-container">
                {notifications.map((notification, index) => (
                    <div
                        key={notification.id}
                        style={{
                            position: 'fixed',
                            top: `${20 + index * 80}px`,
                            right: '20px',
                            zIndex: 10000 + index,
                        }}
                    >
                        <ErrorNotification
                            {...notification}
                            onClose={() => removeNotification(notification.id)}
                        />
                    </div>
                ))}
            </div>
        </>
    );
};

export default NotificationManager;
