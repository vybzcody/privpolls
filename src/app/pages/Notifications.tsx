import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  Bell,
  Clock,
  TrendingUp,
  Check,
  CheckCheck,
  Trash2,
  DollarSign,
} from 'lucide-react';

import { Navbar } from '../components/Navbar';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface Notification {
  id: string;
  type: 'poll-ended' | 'payment-received';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  pollId?: string;
  amount?: string;
}

export function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [showMarkAllModal, setShowMarkAllModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const confirmMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setShowMarkAllModal(false);
  };

  const confirmDelete = () => {
    if (notificationToDelete) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationToDelete));
      setNotificationToDelete(null);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'poll-ended':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'payment-received':
        return <DollarSign className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'poll-ended':
        return 'bg-orange-50';
      case 'payment-received':
        return 'bg-green-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center relative">
                <Bell className="w-5 h-5 text-primary" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">{unreadCount}</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold">Notifications</h1>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMarkAllModal(true)}
              className="gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary text-white'
                : 'bg-white border border-border hover:border-primary/50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary text-white'
                : 'bg-white border border-border hover:border-primary/50'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'read'
                ? 'bg-primary text-white'
                : 'bg-white border border-border hover:border-primary/50'
            }`}
          >
            Read
          </button>
        </div>

        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {filter === 'unread'
                  ? 'No unread notifications'
                  : filter === 'read'
                  ? 'No read notifications'
                  : 'No notifications'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'unread'
                  ? "You're all caught up!"
                  : "You'll be notified when polls you participated in end or when you receive payments"}
              </p>
              {filter !== 'all' && (
                <Button variant="outline" onClick={() => setFilter('all')}>
                  View all notifications
                </Button>
              )}
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
                  notification.read ? 'border-border' : 'border-primary/30 shadow-sm'
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getNotificationBg(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${!notification.read ? 'text-primary' : ''}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {notification.timestamp}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-2">
                      {notification.pollId && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/poll/${notification.pollId}`)}
                          className="h-8"
                        >
                          View Results
                        </Button>
                      )}
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-8 gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Mark read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNotificationToDelete(notification.id)}
                        className="h-8 gap-1 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 p-6 bg-white rounded-xl border border-border">
          <h3 className="font-semibold mb-4">Notification Types</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Poll Ended</p>
                <p className="text-xs text-muted-foreground">When a poll you participated in closes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Payment Received</p>
                <p className="text-xs text-muted-foreground">Rewards from polls you created or participated in</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmationModal
        isOpen={showMarkAllModal}
        onOpenChange={setShowMarkAllModal}
        onConfirm={confirmMarkAllAsRead}
        title="Mark all as read?"
        description="Are you sure you want to mark all notifications as read?"
        confirmText="Mark all read"
      />

      <ConfirmationModal
        isOpen={!!notificationToDelete}
        onOpenChange={(open) => !open && setNotificationToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Notification?"
        description="Are you sure you want to delete this notification? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
