import type { SupplyRequest } from '../types';
import { getItemOfficialCategory } from './itemCategories';

const DEFAULT_ORDER_ICON_URL = 'https://ftldigdbtegrxvluxufs.supabase.co/storage/v1/object/public/public-assets/order_icon.png';

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
    small_arms: 'Small Arms',
    heavy_arms: 'Heavy Arms',
    heavy_ammunition: 'Heavy Ammunition',
    utility: 'Utility & Equipment',
    medical: 'Medical Supplies',
    materials: 'Materials & Supplies',
    uniforms: 'Uniforms',
    aircraft_parts: 'Aircraft Parts',
    vehicles: 'Vehicles',
    shippables: 'Shippables',
    vehicle_crates: 'Vehicle Crates',
    shippable_crates: 'Shippable Crates'
};

export function buildDiscordV2OrderPayload(req: SupplyRequest, iconUrl?: string, currentUserId?: string) {
    if (req.requestType === 'transport') {
        return buildDiscordV2TransportPayload(req, iconUrl, currentUserId);
    }
    const isCompleted = req.status === 'completed';
    const accentColor = isCompleted ? 0x5865F2 : 0x57F287; // Blurple if completed, Green if open

    const shortId = req.id.substring(0, 5).toUpperCase();
    const createdBy = req.createdBy || 'Logistics Member';
    const statusText = isCompleted ? 'COMPLETED' : 'IN PROGRESS';

    const orderIconUrl = iconUrl || DEFAULT_ORDER_ICON_URL;

    const items = req.items || [];
    const groupedItems: Record<string, typeof items> = {};

    for (const item of items) {
        const catKey = getItemOfficialCategory(item.itemName);
        if (!groupedItems[catKey]) {
            groupedItems[catKey] = [];
        }
        groupedItems[catKey].push(item);
    }

    let globalCounter = 1;
    const itemCardNumberMap = new Map<any, number>();

    const categoryBlocks: string[] = [];
    for (const [catKey, catItems] of Object.entries(groupedItems)) {
        const catTitle = CATEGORY_DISPLAY_NAMES[catKey] || 'Other Items';
        const lines: string[] = [`## ${catTitle}`];
        catItems.forEach((item) => {
            const num = globalCounter++;
            itemCardNumberMap.set(item, num);
            const statusMark = (item.quantityDelivered || 0) >= item.quantityRequired ? ' [DONE]' : '';
            lines.push(`**${num}.** ${item.itemName}${statusMark}\n(\`${(item.quantityDelivered || 0).toLocaleString()}\` / \`${item.quantityRequired.toLocaleString()}\`)`);
        });
        categoryBlocks.push(lines.join('\n'));
    }

    const containerComponents: any[] = [
        {
            type: 9, // Section
            components: [
                {
                    type: 10, // TextDisplay
                    content: `## Production Order #${shortId}\n\n<:location:1530196742903955626> **Target Depot:** \`${req.depotName}\` \n\n| <:user:1530196746188095678> **Author:** \`${createdBy}\` | <:status:1530196744040612040> **Status:** \`${statusText}\``
                }
            ],
            accessory: {
                type: 11, // Thumbnail
                media: {
                    url: orderIconUrl
                }
            }
        },
        {
            type: 14, // Separator
            divider: true,
            spacing: 1
        },
        {
            type: 10,
            content: categoryBlocks.join('\n\n') || '*No items listed*'
        }
    ];

    if (!isCompleted && items.length > 0) {
        containerComponents.push({
            type: 14,
            divider: true,
            spacing: 1
        });

        const orderedItemsList: typeof items = [];
        Object.values(groupedItems).forEach(catList => {
            catList.forEach(it => orderedItemsList.push(it));
        });

        const selectOptions = orderedItemsList.slice(0, 25).map((item) => {
            const cardNum = itemCardNumberMap.get(item) || 1;
            const originalIndex = items.indexOf(item);
            const isItemDone = (item.quantityDelivered || 0) >= item.quantityRequired;
            return {
                label: `${cardNum}. ${item.itemName.substring(0, 75)}${isItemDone ? ' [DONE]' : ''}`,
                value: `${originalIndex}`,
                description: `Delivered: ${(item.quantityDelivered || 0).toLocaleString()} / Target: ${item.quantityRequired.toLocaleString()}`
            };
        });

        containerComponents.push({
            type: 1, // ActionRow
            components: [
                {
                    type: 3, // String Select Menu
                    custom_id: `select_deliv_item:${req.id}`,
                    placeholder: 'Select an item to register delivery...',
                    options: selectOptions
                }
            ]
        });

        containerComponents.push({
            type: 1, // ActionRow
            components: [
                {
                    type: 2, // Button
                    style: 4, // Danger (Red)
                    label: 'Cancel Order',
                    custom_id: `cancel_ord:${req.id}`
                }
            ]
        });
    }

    // Explanatory Footer for Partial Delivery
    containerComponents.push({
        type: 14, // Separator
        divider: true,
        spacing: 1
    });

    containerComponents.push({
        type: 10, // TextDisplay
        content: `### How Partial Delivery Works?\nSelect an item from the dropdown menu above to register delivery via pop-up window, or run \`/veli deliver number:1 amount:50\` in this channel.`
    });

    return {
        flags: 32768, // IS_COMPONENTS_V2
        components: [
            {
                type: 17, // Container
                accent_color: accentColor,
                components: containerComponents
            }
        ]
    };
}

export function buildDiscordV2TransportPayload(req: SupplyRequest, iconUrl?: string, currentUserId?: string) {
    const isCompleted = req.status === 'completed';
    const accentColor = isCompleted ? 0x5865F2 : 0x3498DB; // Blurple if completed, Blue if open

    const shortId = req.id.substring(0, 5).toUpperCase();
    const createdBy = req.createdBy || 'Logistics Member';
    const statusText = isCompleted ? 'COMPLETED' : 'IN PROGRESS';
    const sourceDepot = req.sourceDepotName || 'Origin Depot';
    const targetDepot = req.depotName || 'Destination Depot';

    const orderIconUrl = iconUrl || DEFAULT_ORDER_ICON_URL;

    // Transporters
    const claimedByList = req.claimedBy || [];
    const claimedText = claimedByList.length > 0 ? claimedByList.join(', ') : '`None`';

    // Container Blocks
    const containers = req.transportContainers || [];
    const containerBlocks: string[] = [];

    if (containers.length > 0) {
        containers.forEach(c => {
            const lines: string[] = [`## Container #${c.containerIndex} (${c.totalCrates} Crates)`];
            (c.items || []).forEach((item: any) => {
                lines.push(`- **${item.itemName}** : \`${item.count} Crates\``);
            });
            containerBlocks.push(lines.join('\n'));
        });
    } else {
        const items = req.items || [];
        const lines: string[] = [`## Cargo Items`];
        items.forEach((item, idx) => {
            const num = idx + 1;
            const statusMark = item.quantityDelivered >= item.quantityRequired ? ' [DONE]' : '';
            lines.push(`${num}. **${item.itemName}**${statusMark}\n(\`${item.quantityDelivered.toLocaleString()}\` / \`${item.quantityRequired.toLocaleString()}\`)`);
        });
        containerBlocks.push(lines.join('\n'));
    }

    const isUserClaimed = currentUserId ? claimedByList.includes(`<@${currentUserId}>`) : false;
    const claimButtonLabel = isUserClaimed ? 'Unclaim Transport' : 'Claim Transport';
    const claimButtonStyle = isUserClaimed ? 2 : 1; // Secondary (gray) if claimed, Primary (blue) if unclaimed

    const containerComponents: any[] = [
        {
            type: 9, // Section
            components: [
                {
                    type: 10, // TextDisplay
                    content: `## Transport Plan #${shortId}\n\n<:location:1530196742903955626> **Origin:** \`${sourceDepot}\` ➔ **Destination:** \`${targetDepot}\` \n\n| <:user:1530196746188095678> **Author:** \`${createdBy}\` | <:status:1530196744040612040> **Status:** \`${statusText}\`\n\n**Assigned Transporters:** ${claimedText}`
                }
            ],
            accessory: {
                type: 11, // Thumbnail
                media: {
                    url: orderIconUrl
                }
            }
        },
        {
            type: 14, // Separator
            divider: true,
            spacing: 1
        },
        {
            type: 10,
            content: containerBlocks.join('\n\n') || '*No cargo items listed*'
        }
    ];

    if (!isCompleted) {
        containerComponents.push({
            type: 14,
            divider: true,
            spacing: 1
        });

        containerComponents.push({
            type: 1, // ActionRow
            components: [
                {
                    type: 2, // Button
                    style: claimButtonStyle,
                    label: claimButtonLabel,
                    custom_id: `claim_trans:${req.id}`
                },
                {
                    type: 2, // Button
                    style: 4, // Danger (Red)
                    label: 'Cancel Transport',
                    custom_id: `cancel_trans:${req.id}`
                }
            ]
        });
    }

    // Explanatory Footer
    containerComponents.push({
        type: 14, // Separator
        divider: true,
        spacing: 1
    });

    containerComponents.push({
        type: 10, // TextDisplay
        content: `### How Transport Works?\nClick **Claim Transport** to sign up as a transporter. Authorized members can click **Cancel Transport** upon completion to remove the channel.`
    });

    return {
        flags: 32768, // IS_COMPONENTS_V2
        components: [
            {
                type: 17, // Container
                accent_color: accentColor,
                components: containerComponents
            }
        ]
    };
}

const WORKER_SYNC_URL = 'https://foxhole-depot-tracker-bot.efemertk476.workers.dev/sync-order';
const WORKER_DELETE_CHANNEL_URL = 'https://foxhole-depot-tracker-bot.efemertk476.workers.dev/delete-channel';

export async function syncOrderToDiscord(req: SupplyRequest): Promise<{ messageId?: string; channelId?: string }> {
    try {
        const res = await fetch(WORKER_SYNC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ request: req })
        });

        if (res.ok) {
            const data = await res.json() as { messageId?: string; channelId?: string };
            return data;
        } else {
            console.error('Failed to sync order via worker:', await res.text());
        }
    } catch (e) {
        console.error('Discord order sync exception:', e);
    }

    return {};
}

export async function deleteDiscordChannel(channelId: string): Promise<boolean> {
    if (!channelId) return false;
    try {
        const res = await fetch(WORKER_DELETE_CHANNEL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ channelId })
        });
        return res.ok;
    } catch (e) {
        console.error('Discord channel deletion exception:', e);
        return false;
    }
}
