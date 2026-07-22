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
    townName?: string | null;
    subregion?: string | null;
    depotType?: 'frontline' | 'backline';
    isIntegrated?: boolean;
    lastUpdatedBy?: string | null;
}

export type CategoryFilterType = 
    | 'all' 
    | 'small_arms' 
    | 'heavy_arms' 
    | 'heavy_ammunition' 
    | 'utility' 
    | 'medical' 
    | 'materials' 
    | 'uniforms' 
    | 'aircraft_parts' 
    | 'vehicles' 
    | 'shippables'
    | 'vehicle_crates'
    | 'shippable_crates';

export type SortField = 'name' | 'category' | 'prevVal' | 'currVal' | 'diff' | 'target' | 'needed';
export type SortDirection = 'asc' | 'desc' | 'none';

export interface FilterState {
    search: string;
    category: CategoryFilterType;
    change: 'all' | 'increased' | 'decreased' | 'new' | 'nochange';
    sortField?: SortField;
    sortDirection?: SortDirection;
}

export interface DepotSummary {
    hasChanges: boolean;
    inc: number;
    dec: number;
    nw: number;
}

export type UserRole = 'developer' | 'officer' | 'member' | 'logistics_lead' | 'recruit';

export interface RequestItem {
    itemName: string;
    itemCategory: CategoryFilterType;
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
    createdBy?: string;
    stockpileNames?: string;
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

export interface StockpileTemplateRule {
    min: number;
    max: number;
    isPriority?: boolean;
}

export type StockpileTemplates = Record<string, Record<string, StockpileTemplateRule>>;

export type VehicleType = 'flatbed' | 'barge' | 'train';

export interface PackedContainerItem {
    itemName: string;
    category: CategoryFilterType;
    count: number;
    isCriticalNeed?: boolean;
    isPriorityItem?: boolean;
}

export interface PackedContainer {
    containerIndex: number;
    items: PackedContainerItem[];
    totalCrates: number;
    hasCriticalPriority?: boolean;
}

export interface TransferPlan {
    sourceDepotName: string;
    targetDepotName: string;
    containers: PackedContainer[];
    totalCrates: number;
    vehicleType: VehicleType;
    wagonCount?: number;
    priorityItemsCount: number;
    itemsMovedCount: number;
}

export interface RegionSetting {
    regionName: string;
    templateType: string; // 'frontline' | 'backline' | 'aircraft' | 'unassigned' | custom template name
    demandPercentage: number; // 0 to 200
}

export type RegionSettings = Record<string, RegionSetting>;

