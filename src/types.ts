export interface ItemInfo {
    count: number;
    category: 'item' | 'crate' | 'vehicle' | 'structure' | 'crate_vehicle';
}

export interface Depot {
    name: string;
    customName: string | null;
    lastUpdated: string;
    previous: Record<string, ItemInfo> | null;
    current: Record<string, ItemInfo>;
    accessCode?: string;
    isCodePublic?: boolean;
}

export interface FilterState {
    search: string;
    category: 'all' | 'crate' | 'item' | 'vehicle' | 'structure' | 'crate_vehicle';
    change: 'all' | 'increased' | 'decreased' | 'new' | 'nochange';
}

export interface DepotSummary {
    hasChanges: boolean;
    inc: number;
    dec: number;
    nw: number;
}

export type UserRole = 'developer' | 'officer' | 'member';

export interface RequestItem {
    itemName: string;
    itemCategory: 'item' | 'crate' | 'vehicle' | 'structure' | 'crate_vehicle';
    quantityRequired: number;
    quantityDelivered: number;
}

export interface SupplyRequest {
    id: string;
    depotName: string;
    items: RequestItem[];
    createdTime: string;
    status: 'open' | 'completed';
    claimedBy: string[];
}

export interface SystemNotification {
    id: string;
    type: 'announcement' | 'request_created' | 'request_completed' | 'critical_stock';
    message: string;
    timestamp: string;
    isRead: boolean;
    seenBy?: string[];
    announcementTitle?: string;
    announcementContent?: string;
    announcementSeverity?: 'normal' | 'high' | 'critical';
    announcementAuthor?: string;
    announcementRole?: UserRole;
}

export interface Announcement {
    id: string;
    author: string;
    role: UserRole;
    title: string;
    content: string;
    severity: 'normal' | 'high' | 'critical';
    timestamp: string;
    seenBy: string[];
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    username: string;
    role: UserRole;
    action: string;
}

export interface PortalUser {
    id: string;
    username: string;
    role: UserRole;
    status: 'pending' | 'approved' | 'rejected';
    import_count?: number;
    request_count?: number;
    delivery_count?: number;
}

export interface DepotHistoryEntry {
    id: string;
    depot_name: string;
    items: Record<string, ItemInfo>;
    imported_by: string;
    imported_at: string;
}
