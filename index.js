import {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField,
    ComponentType,
    ChannelType
} from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildVoiceStates
    ],
    allowedMentions: {
        parse: ['users'], // Ne parse jamais les rôles (@&role) ni @everyone/@here
        roles: [],        // Interdit strictement toute notification/ping de rôle sur tous les embeds et messages
        repliedUser: false // Aucun ping de notification lors des réponses
    }
});

const PREFIX = '+';
const DATA_FILE = path.resolve('data.json');

// ─── PALETTE GRAPHIQUE (Dark / Cyber Neon Supreme-like) ───────────────────
const COLORS = {
    DEFAULT: 0x1e1f22,
    PRIMARY: 0x5865f2,
    SUCCESS: 0x57f287,
    WARNING: 0xfee75c,
    DANGER: 0xed4245,
    PURPLE: 0x9b59b6,
    CYAN: 0x00bcd4
};

// Message par défaut conforme à votre capture d'écran
const DEFAULT_WELCOME_MESSAGE = '👋 Salut {user} bienvenue sur **{server}** on est maintenant {count} **grâce à toi**';

// ─── GESTIONNAIRE DE PERSISTANCE DES DONNÉES (Sauvegarde disque automatique)
const loadData = () => {
    const defaults = {
        ticketCount: 0,
        ticketConfig: {
            categoryId: null,
            staffRoleId: null,
            logsChannelId: null,
            panelChannelId: null,
            categories: [
                { id: 'general', emoji: '📨', label: 'Support Général', description: 'Aide générale, questions diverses' },
                { id: 'report', emoji: '🚨', label: 'Plainte & Signalement', description: 'Signaler un membre ou un abus' },
                { id: 'partnership', emoji: '🤝', label: 'Partenariats', description: 'Proposer une collaboration' },
                { id: 'billing', emoji: '💎', label: 'Boutique & Rôles', description: 'Renseignements rôles VIP et boutique' }
            ]
        },
        welcomeConfig: {
            enabled: true,
            channelId: null,
            message: DEFAULT_WELCOME_MESSAGE
        },
        autoRoleId: null,
        ghostJoinConfig: {
            enabled: true,
            channels: []
        },
        rolePerms: {
            addRole: null,
            delRole: null,
            derankAllowed: null,
            derankProtected: null
        },
        antiRaid: {
            active: true,
            antiLink: true,
            antiSpam: true,
            antiBot: true,
            antiMention: true,
            maxMentions: 4,
            antiChannel: true,
            antiRole: true,
            antiBan: true
        },
        warnings: {},
        notes: {},
        blacklistedRoles: {},
        openTickets: {},
        prefix: '+',
        owners: [],
        buyers: [],
        managers: [],
        blacklist: [],
        disabledCommands: [],
        commandPerms: {},
        hideReply: false,
        theme: null,
        logs: {
            mod: null,
            msg: null,
            raid: null,
            role: null,
            voice: null,
            boost: null,
            captcha: null
        },
        autoPublish: [],
        autoReact: {},
        captchaConfig: {
            enabled: false,
            roleId: null,
            channelId: null
        },
        counterConfig: {
            enabled: false,
            categoryId: null,
            membersChannelId: null,
            voiceChannelId: null
        }
    };

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
        return defaults;
    }

    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            ticketCount: parsed.ticketCount ?? defaults.ticketCount,
            ticketConfig: { ...defaults.ticketConfig, ...(parsed.ticketConfig || {}) },
            welcomeConfig: { ...defaults.welcomeConfig, ...(parsed.welcomeConfig || {}) },
            autoRoleId: parsed.autoRoleId ?? defaults.autoRoleId,
            ghostJoinConfig: { ...defaults.ghostJoinConfig, ...(parsed.ghostJoinConfig || {}) },
            rolePerms: { ...defaults.rolePerms, ...(parsed.rolePerms || {}) },
            antiRaid: { ...defaults.antiRaid, ...(parsed.antiRaid || {}) },
            warnings: parsed.warnings || {},
            notes: parsed.notes || {},
            blacklistedRoles: parsed.blacklistedRoles || {},
            openTickets: parsed.openTickets || {},
            prefix: parsed.prefix ?? defaults.prefix,
            owners: Array.isArray(parsed.owners) ? parsed.owners : defaults.owners,
            buyers: Array.isArray(parsed.buyers) ? parsed.buyers : defaults.buyers,
            managers: Array.isArray(parsed.managers) ? parsed.managers : defaults.managers,
            blacklist: Array.isArray(parsed.blacklist) ? parsed.blacklist : defaults.blacklist,
            disabledCommands: Array.isArray(parsed.disabledCommands) ? parsed.disabledCommands : defaults.disabledCommands,
            commandPerms: parsed.commandPerms || defaults.commandPerms,
            hideReply: parsed.hideReply ?? defaults.hideReply,
            theme: parsed.theme ?? defaults.theme,
            logs: { ...defaults.logs, ...(parsed.logs || {}) },
            autoPublish: Array.isArray(parsed.autoPublish) ? parsed.autoPublish : defaults.autoPublish,
            autoReact: parsed.autoReact || defaults.autoReact,
            captchaConfig: { ...defaults.captchaConfig, ...(parsed.captchaConfig || {}) },
            counterConfig: { ...defaults.counterConfig, ...(parsed.counterConfig || {}) }
        };
    } catch (e) {
        console.error('[DATABASE] Erreur de lecture de data.json, utilisation des valeurs par défaut:', e);
        return defaults;
    }
};

const initialData = loadData();

const db = {
    warnings: new Map(Object.entries(initialData.warnings)),
    notes: new Map(Object.entries(initialData.notes)),
    antiRaid: initialData.antiRaid,
    rolePerms: initialData.rolePerms,
    blacklistedRoles: initialData.blacklistedRoles || {},
    userMessageTimestamps: new Map(), // Données volatiles (flood) en mémoire
    ticketCount: initialData.ticketCount,
    openTickets: new Map(Object.entries(initialData.openTickets)),
    ticketConfig: initialData.ticketConfig,
    welcomeConfig: initialData.welcomeConfig,
    autoRoleId: initialData.autoRoleId,
    ghostJoinConfig: initialData.ghostJoinConfig,
    prefix: initialData.prefix,
    owners: initialData.owners,
    buyers: initialData.buyers,
    managers: initialData.managers,
    blacklist: initialData.blacklist,
    disabledCommands: initialData.disabledCommands,
    commandPerms: initialData.commandPerms,
    hideReply: initialData.hideReply,
    theme: initialData.theme,
    logs: initialData.logs,
    autoPublish: initialData.autoPublish,
    autoReact: initialData.autoReact,
    captchaConfig: initialData.captchaConfig,
    counterConfig: initialData.counterConfig
};

// Fonction de synchronisation immédiate sur disque
const saveData = () => {
    try {
        const payload = {
            ticketCount: db.ticketCount,
            ticketConfig: db.ticketConfig,
            welcomeConfig: db.welcomeConfig,
            autoRoleId: db.autoRoleId,
            ghostJoinConfig: db.ghostJoinConfig,
            rolePerms: db.rolePerms,
            antiRaid: db.antiRaid,
            blacklistedRoles: db.blacklistedRoles,
            warnings: Object.fromEntries(db.warnings),
            notes: Object.fromEntries(db.notes),
            openTickets: Object.fromEntries(db.openTickets),
            prefix: db.prefix,
            owners: db.owners,
            buyers: db.buyers,
            managers: db.managers,
            blacklist: db.blacklist,
            disabledCommands: db.disabledCommands,
            commandPerms: db.commandPerms,
            hideReply: db.hideReply,
            theme: db.theme,
            logs: db.logs,
            autoPublish: db.autoPublish,
            autoReact: db.autoReact,
            captchaConfig: db.captchaConfig,
            counterConfig: db.counterConfig
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
        console.error('[DATABASE] Erreur lors de l\'enregistrement dans data.json:', err);
    }
};

// Helper formatteur de message de bienvenue avec variables dynamiques
const formatWelcomeMessage = (template, member) => {
    return template
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{member\}/g, `<@${member.id}>`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{tag\}/g, member.user.tag)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{count\}/g, member.guild.memberCount.toString())
        .replace(/\{members\}/g, member.guild.memberCount.toString());
};

// Helper constructeur d'embed standardisé et soigné (prend en compte db.theme)
const makeEmbed = ({ color = null, title, description, fields = [], thumbnail = null, footer = 'Supreme Management · V3.0' }) => {
    let finalColor = color;
    if (!finalColor) {
        if (db.theme) {
            try {
                finalColor = typeof db.theme === 'number' ? db.theme : parseInt(db.theme.replace('#', ''), 16);
            } catch {
                finalColor = COLORS.DEFAULT;
            }
        } else {
            finalColor = COLORS.DEFAULT;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(finalColor)
        .setFooter({ text: footer })
        .setTimestamp();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (fields.length) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);

    return embed;
};

// Vérification privilèges Buyer (Accès global)
const isBuyer = (userId, guild) => {
    if (!userId) return false;
    if (guild && guild.ownerId === userId) return true;
    if (db.buyers && db.buyers.includes(userId)) return true;
    return false;
};

// Vérification privilèges Owner (Co-propriétaire serveur)
const isOwner = (userId, guild) => {
    if (!userId) return false;
    if (isBuyer(userId, guild)) return true;
    if (db.owners && db.owners.includes(userId)) return true;
    return false;
};

// Vérification privilèges Manager (Gestionnaire serveur)
const isManager = (member) => {
    if (!member) return false;
    if (isOwner(member.id, member.guild)) return true;
    if (db.managers && db.managers.includes(member.id)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
};

// Vérification privilèges staff
const isStaff = (member) => {
    if (!member) return false;
    if (isManager(member)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
        member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return true;
    }
    if (db.ticketConfig.staffRoleId && member.roles.cache.has(db.ticketConfig.staffRoleId)) {
        return true;
    }
    return false;
};

// Réponse en cas de permission refusée (gère +hidereply)
const replyPermissionDenied = async (message, reason = 'Vous n\'avez pas les permissions requises.') => {
    if (db.hideReply) return null;
    return message.reply({
        embeds: [makeEmbed({
            color: COLORS.DANGER,
            title: '⛔ Accès refusé',
            description: reason
        })]
    }).catch(() => {});
};

// Fonction de centralisation des logs vers les salons configurés (+autologs / +setlog)
const sendLog = async (guild, type, embed) => {
    if (!guild || !db.logs) return;
    const channelId = db.logs[type];
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({ embeds: [embed] }).catch(() => {});
};

// Mise à jour automatique des salons compteurs de membres & vocaux (+counter)
let counterUpdateDebounce = 0;
const updateServerCounters = async (guild) => {
    if (!guild || !db.counterConfig || !db.counterConfig.enabled) return;
    const now = Date.now();
    if (now - counterUpdateDebounce < 10000) return; // Anti-spam rate limit 10s
    counterUpdateDebounce = now;

    try {
        if (db.counterConfig.membersChannelId) {
            const memChan = guild.channels.cache.get(db.counterConfig.membersChannelId);
            if (memChan) {
                const targetName = `👥・Membres : ${guild.memberCount}`;
                if (memChan.name !== targetName) {
                    await memChan.setName(targetName).catch(() => {});
                }
            }
        }
        if (db.counterConfig.voiceChannelId) {
            const vChan = guild.channels.cache.get(db.counterConfig.voiceChannelId);
            if (vChan) {
                const voiceCount = guild.members.cache.filter(m => m.voice?.channelId).size;
                const targetName = `🔊・En Vocal : ${voiceCount}`;
                if (vChan.name !== targetName) {
                    await vChan.setName(targetName).catch(() => {});
                }
            }
        }
    } catch (e) {
        console.error('[COUNTER] Erreur mise à jour compteurs:', e.message);
    }
};

// Cache en mémoire pour les codes Captcha temporaires
const captchaCodes = new Map();

// ─── PANEL DE CONFIGURATION GHOST-JOIN (+set ghostjoin) ───────────────────
const buildGhostJoinEmbed = (guild) => {
    const cfg = db.ghostJoinConfig;
    const statusDisplay = cfg.enabled ? '🟢 **Actif**' : '🔴 **Désactivé**';

    const channelsDisplay = (cfg.channels && cfg.channels.length > 0)
        ? cfg.channels.map(id => `<#${id}>`).join(' ')
        : '`Aucun salon sélectionné`';

    const embed = new EmbedBuilder()
        .setColor(COLORS.PURPLE)
        .setTitle('👻 Configuration Ghost-Join · Supreme Management')
        .setDescription([
            `Le module **Ghost-Join** déclenche une mention fantôme (supprimée instantanément) dans les salons cibles dès qu'un membre rejoint **${guild.name}**.`,
            `Cela permet d'attirer l'attention du nouveau membre sur vos salons stratégiques (règlement, annonces, boutique) sans polluer le chat.`,
            ``,
            `### 📌 Configuration Actuelle :`,
            `> 🔘 **Statut du module :** ${statusDisplay}`,
            `> 📁 **Salons sélectionnés (${cfg.channels ? cfg.channels.length : 0}) :**`,
            `> ${channelsDisplay}`,
            `> ⚡ **Délai de suppression :** Immédiat (Ghost-Ping discret)`,
            `> 💾 **Sauvegarde permanente :** \`data.json\` (conservé après reboot)`,
            ``,
            `*Sélectionnez jusqu'à 10 salons textuels ci-dessous pour activer le ghost-join automatique.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · GhostJoin Module' })
        .setTimestamp();

    const channelSelectRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('ghostjoin_select_channels')
            .setPlaceholder('👻 Choisissez les salons où ghostping le membre...')
            .setChannelTypes(ChannelType.GuildText)
            .setMinValues(0)
            .setMaxValues(10)
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ghostjoin_btn_toggle')
            .setLabel(cfg.enabled ? 'Désactiver' : 'Activer')
            .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(cfg.enabled ? '⏸️' : '▶️'),
        new ButtonBuilder()
            .setCustomId('ghostjoin_btn_test')
            .setLabel('Tester le Ghost-Join')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧪')
            .setDisabled(!cfg.channels || cfg.channels.length === 0),
        new ButtonBuilder()
            .setCustomId('ghostjoin_btn_clear')
            .setLabel('Vider les Salons')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(!cfg.channels || cfg.channels.length === 0)
    );

    return { embed, components: [channelSelectRow, buttonRow] };
};

// ─── PANEL DE CONFIGURATION DE L'AUTOROLE (+set autorole) ─────────────────
const buildAutoRoleEmbed = (guild) => {
    const autoRoleObj = db.autoRoleId ? guild.roles.cache.get(db.autoRoleId) : null;
    const roleDisplay = autoRoleObj ? `**@${autoRoleObj.name}** (\`${db.autoRoleId}\`)` : (db.autoRoleId ? `<@&${db.autoRoleId}>` : '`Non configuré (Désactivé)`');

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎭 Configuration de l\'Auto-Rôle')
        .setDescription([
            `L'auto-rôle est attribué immédiatement à chaque nouveau membre rejoignant **${guild.name}**.`,
            ``,
            `### 📌 Paramètre Actuel :`,
            `> 🎭 **Rôle attribué à l'arrivée :** ${roleDisplay}`,
            `> 💾 **Sauvegarde permanente :** \`data.json\` (conservé après reboot)`,
            ``,
            `*Sélectionnez un rôle ci-dessous pour l'activer, ou cliquez sur désactiver.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Auto-Role Module' })
        .setTimestamp();

    const roleSelectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('autorole_select_role')
            .setPlaceholder('🎭 Sélectionnez le rôle à donner automatiquement...')
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('autorole_btn_disable')
            .setLabel('Désactiver l\'Auto-Rôle')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(!db.autoRoleId)
    );

    return { embed, components: [roleSelectRow, buttonRow] };
};

// ─── PANEL DE CONFIGURATION DE BIENVENUE (+set welcome) ───────────────────
const buildWelcomeConfigEmbed = (guild, memberAuthor) => {
    const cfg = db.welcomeConfig;
    const channelDisplay = cfg.channelId ? `<#${cfg.channelId}> (\`${cfg.channelId}\`)` : '`Non configuré (aucun envoi)`';
    const statusDisplay = cfg.enabled ? '🟢 **Actif**' : '🔴 **Désactivé**';

    const previewSample = formatWelcomeMessage(cfg.message, memberAuthor);

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('👋 Configuration du Message de Bienvenue')
        .setDescription([
            `Bienvenue dans le panneau de gestion des nouveaux membres pour **${guild.name}**.`,
            ``,
            `### 📌 Paramètres Actuels :`,
            `> 🔘 **Statut :** ${statusDisplay}`,
            `> 📢 **Salon de diffusion :** ${channelDisplay}`,
            `> 💾 **Sauvegarde :** \`data.json\` (Persistant après reboot)`,
            ``,
            `### 📝 Modèle de Message Actuel :`,
            `\`\`\`text\n${cfg.message}\n\`\`\``,
            ``,
            `### 👁️ Aperçu en direct (Vraies données de votre serveur) :`,
            previewSample,
            ``,
            `### 💡 Variables disponibles :`,
            `• \`{user}\` : Mentionne le nouvel arrivant`,
            `• \`{server}\` : Nom réel de votre serveur (${guild.name})`,
            `• \`{count}\` : Nombre total de membres (${guild.memberCount})`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Welcome Module' })
        .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('wlc_btn_channel')
            .setLabel('Définir Salon')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📢'),
        new ButtonBuilder()
            .setCustomId('wlc_btn_edit_msg')
            .setLabel('Modifier Message')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✍️'),
        new ButtonBuilder()
            .setCustomId('wlc_btn_toggle')
            .setLabel(cfg.enabled ? 'Désactiver' : 'Activer')
            .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(cfg.enabled ? '⏸️' : '▶️'),
        new ButtonBuilder()
            .setCustomId('wlc_btn_test')
            .setLabel('Tester')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧪'),
        new ButtonBuilder()
            .setCustomId('wlc_btn_reset')
            .setLabel('Message par défaut')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
    );

    return { embed, actionRow };
};

// ─── PANEL PUBLIC DE CRÉATION DE TICKET (Dynamique selon vos catégories) ───
const generateTicketPublicPanel = (guild) => {
    const categoriesList = db.ticketConfig.categories.length > 0
        ? db.ticketConfig.categories.map(c => `> ${c.emoji} **${c.label}** : ${c.description}`).join('\n')
        : '> *Aucune catégorie configurée.*';

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎫 Centre d\'Assistance · Support & Réclamations')
        .setDescription([
            `Bienvenue sur l'espace d'assistance de **${guild.name}**.`,
            ``,
            `Pour ouvrir un ticket privé avec l'équipe du serveur, veuillez sélectionner la catégorie correspondant à votre demande dans le menu déroulant ci-dessous.`,
            ``,
            categoriesList,
            ``,
            `*Un salon privé et sécurisé sera automatiquement généré.*`
        ].join('\n'))
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Supreme Management · Support Client' })
        .setTimestamp();

    const options = db.ticketConfig.categories.map(c => (
        new StringSelectMenuOptionBuilder()
            .setLabel(c.label.slice(0, 100))
            .setDescription(c.description.slice(0, 100))
            .setValue(c.id)
            .setEmoji(c.emoji)
    ));

    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_select_category')
            .setPlaceholder('📂 Choisissez un motif pour ouvrir votre ticket...')
            .addOptions(options.length > 0 ? options : [
                new StringSelectMenuOptionBuilder()
                    .setLabel('Support')
                    .setValue('default')
                    .setDescription('Assistance générale')
                    .setEmoji('📩')
            ])
    );

    return { embed, selectMenu };
};

// ─── PANNEAU DE CONFIGURATION COMPLET DES TICKETS (Style SupremeBot) ──────
const buildTicketConfigEmbed = (guild) => {
    const cfg = db.ticketConfig;

    const categoryText = cfg.categoryId ? `<#${cfg.categoryId}> (\`${cfg.categoryId}\`)` : '`Non configurée (Racine)`';
    const staffRoleObj = cfg.staffRoleId ? guild.roles.cache.get(cfg.staffRoleId) : null;
    const roleText = staffRoleObj ? `**@${staffRoleObj.name}** (\`${cfg.staffRoleId}\`)` : (cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : '`Non configuré (Admin uniquement)`');
    const logsText = cfg.logsChannelId ? `<#${cfg.logsChannelId}> (\`${cfg.logsChannelId}\`)` : '`Désactivé`';
    const panelText = cfg.panelChannelId ? `<#${cfg.panelChannelId}>` : '`Non déployé`';

    const categoriesFormatted = cfg.categories.length > 0
        ? cfg.categories.map((c, i) => {
            const catChan = c.categoryId ? `<#${c.categoryId}>` : (cfg.categoryId ? `<#${cfg.categoryId}> *(défaut)*` : '`Non configurée`');
            return `\`${i + 1}.\` ${c.emoji} **${c.label}** — *${c.description}*\n   ↳ 📁 **Salon Catégorie :** ${catChan}`;
        }).join('\n')
        : '`Aucune catégorie configurée`';

    const embed = new EmbedBuilder()
        .setColor(COLORS.CYAN)
        .setTitle('⚙️ Panneau de Configuration · Système de Tickets')
        .setDescription([
            `Gestionnaire centralisé des tickets de **${guild.name}**.`,
            `Toutes vos configurations sont sauvegardées en continu sur le disque.`,
            ``,
            `### 📌 Infrastructure :`,
            `> 📁 **Catégorie Salons :** ${categoryText}`,
            `> 🛡️ **Rôle Support / Staff :** ${roleText}`,
            `> 📜 **Salon des Logs :** ${logsText}`,
            `> 📢 **Emplacement du Panel :** ${panelText}`,
            `> 💾 **Persistance :** \`data.json\` (Chargé au démarrage)`,
            ``,
            `### 📂 Vos Catégories / Motifs Configurés (${cfg.categories.length}) :`,
            categoriesFormatted,
            ``,
            `*Utilisez les boutons ci-dessous pour ajouter, supprimer vos catégories ou modifier les paramètres.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Dashboard Discord' })
        .setTimestamp();

    const rowCategories = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cfg_btn_add_category')
            .setLabel('Ajouter Catégorie')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('cfg_btn_del_category')
            .setLabel('Supprimer Catégorie')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➖')
            .setDisabled(cfg.categories.length === 0),
        new ButtonBuilder()
            .setCustomId('cfg_btn_reset_categories')
            .setLabel('Catégories par défaut')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
    );

    const rowSettings = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cfg_btn_category')
            .setLabel('Salon Catégorie')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📁'),
        new ButtonBuilder()
            .setCustomId('cfg_btn_role')
            .setLabel('Rôle Staff')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId('cfg_btn_logs')
            .setLabel('Salon Logs')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📜'),
        new ButtonBuilder()
            .setCustomId('cfg_btn_deploy')
            .setLabel('Déployer Panel')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚀'),
        new ButtonBuilder()
            .setCustomId('cfg_btn_reset')
            .setLabel('Reset Global')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
    );

    return { embed, components: [rowCategories, rowSettings] };
};

// ─── HELPER RÉSOLUTEUR INTELLIGENT MEMBRE & RÔLE ─────────────────────────────
const resolveMemberAndRole = async (guild, arg1, arg2) => {
    if (!arg1 || !arg2) return { role: null, member: null };
    const clean1 = arg1.replace(/[<@!&>]/g, '');
    const clean2 = arg2.replace(/[<@!&>]/g, '');

    // Tentative 1 : arg1 = Role, arg2 = Member
    let role = guild.roles.cache.get(clean1);
    let member = guild.members.cache.get(clean2) || await guild.members.fetch(clean2).catch(() => null);

    if (role && member) return { role, member };

    // Tentative 2 : arg1 = Member, arg2 = Role
    member = guild.members.cache.get(clean1) || await guild.members.fetch(clean1).catch(() => null);
    role = guild.roles.cache.get(clean2);

    if (role && member) return { role, member };
    return { role: null, member: null };
};

// ─── PANEL DE CONFIGURATION +addrole (+set addrole) ────────────────────────
const buildAddRoleConfigEmbed = (guild) => {
    const roleId = db.rolePerms.addRole;
    const roleObj = roleId ? guild.roles.cache.get(roleId) : null;
    const roleDisplay = roleObj ? `**@${roleObj.name}** (\`${roleId}\`)` : (roleId ? `<@&${roleId}>` : '`Administrateurs uniquement (par défaut)`');

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎭 Configuration du Rôle d\'Attribution (+addrole)')
        .setDescription([
            `Configurez quel rôle de modération est autorisé à exécuter la commande \`${PREFIX}addrole\` sur **${guild.name}**.`,
            ``,
            `### 📌 Paramètres Actuels :`,
            `> 🛡️ **Rôle Autorisé :** ${roleDisplay}`,
            `> 👑 **Propriétaire & Administrateurs :** Toujours autorisés par défaut`,
            `> 💾 **Sauvegarde permanente :** \`data.json\` (Persistant après reboot)`,
            ``,
            `*Sélectionnez un rôle ci-dessous pour l'autoriser à ajouter des rôles, ou réinitialisez pour réserver aux Administrateurs.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Permissions Rôles' })
        .setTimestamp();

    const roleSelectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('set_addrole_select_role')
            .setPlaceholder('🎭 Sélectionnez le rôle autorisé à faire +addrole...')
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('set_addrole_btn_reset')
            .setLabel('Réinitialiser (Admin Only)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
            .setDisabled(!roleId),
        new ButtonBuilder()
            .setCustomId('panel_btn_close')
            .setLabel('Fermer')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );

    return { embed, components: [roleSelectRow, buttonRow] };
};

// ─── PANEL DE CONFIGURATION +delrole (+set delrole) ────────────────────────
const buildDelRoleConfigEmbed = (guild) => {
    const roleId = db.rolePerms.delRole;
    const roleObj = roleId ? guild.roles.cache.get(roleId) : null;
    const roleDisplay = roleObj ? `**@${roleObj.name}** (\`${roleId}\`)` : (roleId ? `<@&${roleId}>` : '`Administrateurs uniquement (par défaut)`');

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎭 Configuration du Rôle de Révocation (+delrole)')
        .setDescription([
            `Configurez quel rôle de modération est autorisé à exécuter la commande \`${PREFIX}delrole\` sur **${guild.name}**.`,
            ``,
            `### 📌 Paramètres Actuels :`,
            `> 🛡️ **Rôle Autorisé :** ${roleDisplay}`,
            `> 👑 **Propriétaire & Administrateurs :** Toujours autorisés par défaut`,
            `> 💾 **Sauvegarde permanente :** \`data.json\` (Persistant après reboot)`,
            ``,
            `*Sélectionnez un rôle ci-dessous pour l'autoriser à retirer des rôles, ou réinitialisez pour réserver aux Administrateurs.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Permissions Rôles' })
        .setTimestamp();

    const roleSelectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('set_delrole_select_role')
            .setPlaceholder('🎭 Sélectionnez le rôle autorisé à faire +delrole...')
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('set_delrole_btn_reset')
            .setLabel('Réinitialiser (Admin Only)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
            .setDisabled(!roleId),
        new ButtonBuilder()
            .setCustomId('panel_btn_close')
            .setLabel('Fermer')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );

    return { embed, components: [roleSelectRow, buttonRow] };
};

// ─── PANEL DE CONFIGURATION +derank (+set derank) ──────────────────────────
const buildDerankConfigEmbed = (guild) => {
    const allowedId = db.rolePerms.derankAllowed;
    const protectedId = db.rolePerms.derankProtected;

    const allowedObj = allowedId ? guild.roles.cache.get(allowedId) : null;
    const protectedObj = protectedId ? guild.roles.cache.get(protectedId) : null;

    const allowedDisplay = allowedObj ? `**@${allowedObj.name}** (\`${allowedId}\`)` : (allowedId ? `<@&${allowedId}>` : '`Administrateurs uniquement (par défaut)`');
    const protectedDisplay = protectedObj ? `**@${protectedObj.name}** (\`${protectedId}\`)` : (protectedId ? `<@&${protectedId}>` : '`Aucun (retire TOUS les rôles)`');

    const embed = new EmbedBuilder()
        .setColor(COLORS.DANGER)
        .setTitle('⚡ Configuration du Module Derank (+set derank)')
        .setDescription([
            `Le module **Derank** permet de destituer instantanément un membre en retirant tous ses rôles en une seule commande (\`${PREFIX}derank @membre\`).`,
            ``,
            `### 📌 Paramètres Actuels :`,
            `> 🛡️ **Rôle Autorisé à Derank :** ${allowedDisplay}`,
            `> 🔰 **Rôle Protégé (Non retiré) :** ${protectedDisplay}`,
            `> 💾 **Sauvegarde permanente :** \`data.json\` (Persistant après reboot)`,
            ``,
            `### ⚙️ Particularité du Rôle Protégé :`,
            `• **Si configuré :** Lors d'un \`${PREFIX}derank\`, ce rôle précis (ex: *Membre*, *Citoyen*, *Joueur*) sera **conservé** sur l'utilisateur tandis que tous les rôles supérieurs ou staffs sont révoqués.`,
            `• **Si laissé vide :** Le bot retire **absolument tous les rôles** modifiables du membre sans exception !`,
            ``,
            `*Utilisez les sélecteurs natifs ci-dessous pour ajuster vos permissions et votre rôle protégé.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Sécurité Derank' })
        .setTimestamp();

    const allowedSelectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('set_derank_select_allowed')
            .setPlaceholder('🛡️ Rôle autorisé à exécuter +derank...')
    );

    const protectedSelectRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('set_derank_select_protected')
            .setPlaceholder('🔰 Rôle à protéger (laisser vide pour tout retirer)...')
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('set_derank_btn_clear_protected')
            .setLabel('Effacer Rôle Protégé (Retirer Tout)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(!protectedId),
        new ButtonBuilder()
            .setCustomId('set_derank_btn_reset_allowed')
            .setLabel('Reset Rôle Autorisé (Admin Only)')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
            .setDisabled(!allowedId),
        new ButtonBuilder()
            .setCustomId('panel_btn_close')
            .setLabel('Fermer')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );

    return { embed, components: [allowedSelectRow, protectedSelectRow, buttonRow] };
};

// ─── DASHBOARD INTERACTIF ANTI-RAID (+antiraid / +securite) ────────────────
const buildAntiRaidConfigEmbed = (guild) => {
    const ar = db.antiRaid;
    const globalStatus = ar.active ? '🟢 **ACTIF (Protection maximale)**' : '🔴 **PAUSE (Système inactif)**';

    const embed = new EmbedBuilder()
        .setColor(ar.active ? COLORS.SUCCESS : COLORS.DANGER)
        .setTitle('🛡️ Dashboard Sécurité Anti-Raid · Supreme Security')
        .setDescription([
            `Système de défense haute performance contre les attaques coordonnées, le spam et les abus sur **${guild.name}**.`,
            ``,
            `### ⚡ Statut Global : ${globalStatus}`,
            ``,
            `### 🔒 Protections Actives en Temps Réel :`,
            `> 🔗 **Anti-Link :** ${ar.antiLink ? '🟢 Activé *(Supprime les invitations)*' : '🔴 Désactivé'}`,
            `> 💬 **Anti-Spam :** ${ar.antiSpam ? '🟢 Activé *(Mute automatique flood)*' : '🔴 Désactivé'}`,
            `> 🤖 **Anti-Bot :** ${ar.antiBot ? '🟢 Activé *(Expulsion bots non autorisés)*' : '🔴 Désactivé'}`,
            `> 📢 **Anti-Mention :** ${ar.antiMention ? `🟢 Activé *(Seuil max : ${ar.maxMentions})*` : '🔴 Désactivé'}`,
            `> 📁 **Anti-Channel :** ${ar.antiChannel ? '🟢 Activé *(Protection salons)*' : '🔴 Désactivé'}`,
            `> 🎭 **Anti-Role :** ${ar.antiRole ? '🟢 Activé *(Protection rôles)*' : '🔴 Désactivé'}`,
            `> 🔨 **Anti-MassBan :** ${ar.antiBan ? '🟢 Activé *(Alerte & blocage bans massifs)*' : '🔴 Désactivé'}`,
            ``,
            `*Cliquez sur les boutons ci-dessous pour basculer instantanément chaque module.*`
        ].join('\n'))
        .setFooter({ text: 'Supreme Management · Anti-Raid Engine' })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_link')
            .setLabel(`Anti-Link ${ar.antiLink ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiLink ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🔗'),
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_spam')
            .setLabel(`Anti-Spam ${ar.antiSpam ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiSpam ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('💬'),
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_bot')
            .setLabel(`Anti-Bot ${ar.antiBot ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiBot ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🤖'),
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_mention')
            .setLabel(`Anti-Mention ${ar.antiMention ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiMention ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('📢')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_channel')
            .setLabel(`Anti-Channel ${ar.antiChannel ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiChannel ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('📁'),
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_role')
            .setLabel(`Anti-Role ${ar.antiRole ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiRole ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_ban')
            .setLabel(`Anti-Ban ${ar.antiBan ? 'ON' : 'OFF'}`)
            .setStyle(ar.antiBan ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🔨'),
        new ButtonBuilder()
            .setCustomId('antiraid_toggle_global')
            .setLabel(ar.active ? 'Tout Mettre en Pause' : 'Activer Tout')
            .setStyle(ar.active ? ButtonStyle.Danger : ButtonStyle.Primary)
            .setEmoji(ar.active ? '⏸️' : '▶️')
    );

    return { embed, components: [row1, row2] };
};

// ─── MODULE D'AIDE INTERACTIF (Dropdown Menu Style SupremeBot) ──────────────
const generateHelpData = () => {
    const categories = {
        home: {
            title: '⚡ SupremeBot Gestion · Panneau Central',
            description: [
                `**Préfixe actif :** \`${PREFIX}\``,
                `Système de gestion, modération avancée et sécurisation de serveur.`,
                `💾 **Persistance totale :** Sauvegarde automatique sur disque \`data.json\`.`,
                ``,
                `Sélectionnez une catégorie ci-dessous pour inspecter les commandes disponibles.`
            ].join('\n'),
            fields: [
                { name: '🛡️ Modération & Sanctions', value: `\`${PREFIX}ban\`, \`${PREFIX}tempban\`, \`${PREFIX}kick\`, \`${PREFIX}mute\`, \`${PREFIX}warn\`, ...`, inline: false },
                { name: '👻 Ghost-Join & Bienvenue', value: `\`${PREFIX}set ghostjoin\`, \`${PREFIX}set welcome\`, pings fantômes discrets`, inline: false },
                { name: '🎭 Rôles & Attribution Massive', value: `\`${PREFIX}set autorole\`, \`${PREFIX}massivrole <id_rôle>\`, \`${PREFIX}addrole\`, ...`, inline: false },
                { name: '🎫 Tickets Personnalisables', value: `\`${PREFIX}ticket config\`, \`${PREFIX}ticket addcat\`, \`${PREFIX}ticket send\`, ...`, inline: false },
                { name: '🔒 Sécurité & Salons', value: `\`${PREFIX}lock\`, \`${PREFIX}unlock\`, \`${PREFIX}hide\`, \`${PREFIX}unhide\`, \`${PREFIX}antiraid\`, ...`, inline: false },
                { name: '📊 Utilitaires & Stats', value: `\`${PREFIX}serverinfo\`, \`${PREFIX}userinfo\`, \`${PREFIX}botinfo\`, \`${PREFIX}ping\`, ...`, inline: false }
            ]
        },
        moderation: {
            title: '🛡️ Module : Modération & Sanctions',
            description: 'Commandes de répression et traçage des infractions.',
            fields: [
                { name: `\`${PREFIX}ban <@user> [raison]\``, value: 'Bannit définitivement un utilisateur du serveur.', inline: false },
                { name: `\`${PREFIX}tempban <@user> <minutes> [raison]\``, value: 'Bannit temporairement avec débannissement automatique.', inline: false },
                { name: `\`${PREFIX}unban <id>\``, value: 'Révoque le bannissement d\'un membre par ID.', inline: false },
                { name: `\`${PREFIX}kick <@user> [raison]\``, value: 'Expulse le membre ciblé du serveur.', inline: false },
                { name: `\`${PREFIX}mute / ${PREFIX}tempmute <@user> <minutes> [raison]\``, value: 'Exclut temporairement (Timeout Discord natif).', inline: false },
                { name: `\`${PREFIX}unmute <@user>\``, value: 'Rétablit les droits de parole d\'un membre.', inline: false },
                { name: `\`${PREFIX}warn <@user> <raison>\``, value: 'Attribue un avertissement formel au membre.', inline: false },
                { name: `\`${PREFIX}warnings <@user>\``, value: 'Consulte le casier d\'avertissements d\'un utilisateur.', inline: false },
                { name: `\`${PREFIX}clear <1-100>\``, value: 'Suppression groupée de messages dans le salon.', inline: false },
                { name: `\`${PREFIX}note <@user> <texte>\``, value: 'Ajoute une note confidentielle au dossier staff.', inline: false },
                { name: `\`${PREFIX}notes <@user>\``, value: 'Consulte l\'ensemble des notes enregistrées sur un profil.', inline: false }
            ]
        },
        ghostjoin: {
            title: '👻 Module : Ghost-Join Automatique',
            description: 'Pings fantômes instantanés à l\'arrivée pour attirer l\'attention sur des salons clés.',
            fields: [
                { name: `\`${PREFIX}set ghostjoin\` ou \`${PREFIX}ghostjoin\``, value: 'Ouvre le panneau interactif avec sélecteur multi-salons textuels, bouton d\'activation et test.', inline: false },
                { name: `\`${PREFIX}set ghostjoin [#salon1 #salon2 ...]\``, value: 'Configure directement la liste des salons cibles en une seule commande.', inline: false },
                { name: `\`${PREFIX}set ghostjoin off / on\``, value: 'Active ou met en pause le ghost-ping automatique.', inline: false }
            ]
        },
        roles: {
            title: '🎭 Module : Gestion des Rôles & Permissions Granulaires',
            description: 'Attribution automatique, massive, derank protégé et contrôle d\'accès strict.',
            fields: [
                { name: `\`${PREFIX}addrole <id_rôle|@rôle> <id_membre|@membre>\``, value: 'Attribue un rôle au membre ciblé. Accessible aux Admins et au rôle configuré.', inline: false },
                { name: `\`${PREFIX}set addrole\``, value: 'Ouvre le panneau interactif pour définir quel rôle peut exécuter `+addrole`.', inline: false },
                { name: `\`${PREFIX}delrole <id_rôle|@rôle> <id_membre|@membre>\``, value: 'Retire un rôle existant du membre ciblé.', inline: false },
                { name: `\`${PREFIX}set delrole\``, value: 'Ouvre le panneau interactif pour définir quel rôle peut exécuter `+delrole`.', inline: false },
                { name: `\`${PREFIX}derank <@membre|id>\``, value: 'Retire immédiatement tous les rôles du membre, **sauf le rôle protégé** configuré.', inline: false },
                { name: `\`${PREFIX}set derank\``, value: 'Configure le rôle autorisé à derank ET le rôle protégé (ex: Membre). Si vide, retire tout !', inline: false },
                { name: `\`${PREFIX}blrank <id_rôle|@rôle> <id_mec|@membre>\``, value: 'Interdit formellement un rôle à un membre (retrait immédiat + protection active).', inline: false },
                { name: `\`${PREFIX}unblrank <id_rôle|@rôle> <id_mec|@membre>\``, value: 'Lève l\'interdiction du rôle pour le membre ciblé.', inline: false },
                { name: `\`${PREFIX}set autorole [@rôle/id/off]\``, value: 'Configure le rôle attribué automatiquement à l\'arrivée d\'un nouveau membre.', inline: false },
                { name: `\`${PREFIX}massivrole <id_rôle ou @rôle>\``, value: 'Attribue en masse le rôle ciblé à **tous les membres** du serveur avec barre de progression.', inline: false },
                { name: `\`${PREFIX}nick <@user> <nouveau_nom>\``, value: 'Modifie le surnom du membre sur le serveur.', inline: false },
                { name: `\`${PREFIX}roleinfo <@role>\``, value: 'Affiche la configuration technique et permissions d\'un rôle.', inline: false }
            ]
        },
        welcome: {
            title: '👋 Module : Système de Bienvenue',
            description: 'Annonce automatique à l\'arrivée d\'un nouveau membre avec calcul des vrais membres.',
            fields: [
                { name: `\`${PREFIX}set welcome\``, value: 'Ouvre le panneau interactif complet (choix du salon, aperçu, modification).', inline: false },
                { name: `\`${PREFIX}set welcome [#salon] [message]\``, value: 'Configure directement le salon et le message (ou message par défaut si omis).', inline: false },
                { name: `Message par défaut intégré`, value: '`👋 Salut {user} bienvenue sur **{server}** on est maintenant {count} **grâce à toi**`', inline: false }
            ]
        },
        tickets: {
            title: '🎫 Module : Tickets 100% Personnalisables',
            description: 'Configuration visuelle de vos motifs, rôles et salons.',
            fields: [
                { name: `\`${PREFIX}ticket config\` ou \`${PREFIX}ticket\``, value: 'Ouvre le panneau de configuration interactif (Modals, sélecteurs natifs).', inline: false },
                { name: `\`${PREFIX}ticket addcat <emoji> <nom> | <description>\``, value: 'Ajoute directement un nouveau motif de ticket.', inline: false },
                { name: `\`${PREFIX}ticket delcat <nom>\``, value: 'Supprime un motif existant.', inline: false },
                { name: `\`${PREFIX}ticket listcat\``, value: 'Liste vos catégories de ticket actuelles et leurs salons hôtes.', inline: false },
                { name: `\`${PREFIX}ticket setcat <nom_motif> <id_catégorie>\``, value: 'Assigne une catégorie Discord distincte pour chaque motif de ticket.', inline: false },
                { name: `\`${PREFIX}ticket send [#salon]\``, value: 'Déploie le panel public interactif dans le salon souhaité.', inline: false },
                { name: `\`${PREFIX}rename <nouveau nom>\``, value: 'Renomme le salon du ticket en cours (Staff ou Auteur).', inline: false },
                { name: `\`${PREFIX}close [raison]\``, value: 'Ferme et supprime le ticket avec compte à rebours de 5s et logs.', inline: false },
                { name: `\`${PREFIX}add <@membre/id>\``, value: 'Ajoute un membre au ticket actuel.', inline: false },
                { name: `\`${PREFIX}del <@membre/id>\``, value: 'Retire un membre du ticket actuel.', inline: false }
            ]
        },
        hierarchy: {
            title: '👑 Module : Hiérarchie, Buyers & Blacklist',
            description: 'Gestion des privilèges avancés, co-propriétaires, buyers et liste noire.',
            fields: [
                { name: `\`${PREFIX}owner <@membre/id>\``, value: 'Ajoute un co-propriétaire sur le serveur.', inline: false },
                { name: `\`${PREFIX}unowner <@membre/id>\``, value: 'Retire un co-propriétaire du serveur.', inline: false },
                { name: `\`${PREFIX}owners\``, value: 'Liste tous les propriétaires et co-propriétaires actuels.', inline: false },
                { name: `\`${PREFIX}buyer / ${PREFIX}addbuy <@membre/id>\``, value: 'Attribue le statut Buyer (accès global suprême).', inline: false },
                { name: `\`${PREFIX}unbuyer / ${PREFIX}delbuy <@membre/id>\``, value: 'Révoque le statut Buyer d\'un membre.', inline: false },
                { name: `\`${PREFIX}addmanager <@membre/id>\``, value: 'Délègue les permissions de gestionnaire sur le bot.', inline: false },
                { name: `\`${PREFIX}delmanager <@membre/id>\``, value: 'Retire un gestionnaire du bot.', inline: false },
                { name: `\`${PREFIX}bl <@membre/id> [raison]\``, value: 'Bannit et place un membre sur la blacklist du bot.', inline: false },
                { name: `\`${PREFIX}unbl <id>\``, value: 'Retire un membre de la blacklist globale.', inline: false }
            ]
        },
        logs: {
            title: '📁 Module : Logs & Traçabilité Complète',
            description: 'Surveillance et archivage de toutes les actions du serveur dans des salons dédiés.',
            fields: [
                { name: `\`${PREFIX}autologs\``, value: 'Génère automatiquement la catégorie et l\'ensemble des 7 salons de logs privés.', inline: false },
                { name: `\`${PREFIX}setlog <type> <#salon>\``, value: 'Configure manuellement un salon pour un type précis (mod, msg, raid, role, voice, boost, captcha).', inline: false },
                { name: `\`${PREFIX}modlogs [#salon|off]\``, value: 'Active et route les logs des sanctions (bans, kicks, mutes).', inline: false },
                { name: `\`${PREFIX}msglogs [#salon|off]\``, value: 'Active les logs des suppressions et modifications de messages.', inline: false },
                { name: `\`${PREFIX}raidlogs [#salon|off]\``, value: 'Active les alertes en direct de l\'anti-raid.', inline: false },
                { name: `\`${PREFIX}rolelogs [#salon|off]\``, value: 'Active les logs de création, suppression et attribution de rôles.', inline: false },
                { name: `\`${PREFIX}voicelogs [#salon|off]\``, value: 'Active les logs des connexions, déconnexions et déplacements vocaux.', inline: false },
                { name: `\`${PREFIX}boostlogs [#salon|off]\``, value: 'Active les logs des boosts de serveur.', inline: false },
                { name: `\`${PREFIX}captchalogs [#salon|off]\``, value: 'Active les logs des vérifications captcha.', inline: false }
            ]
        },
        automation: {
            title: '⚡ Module : Automatisation & Système',
            description: 'Auto-modération, captcha, compteurs dynamiques et configuration globale.',
            fields: [
                { name: `\`${PREFIX}autoperm\``, value: 'Configure automatiquement des permissions saines (sécurisation immédiate de @everyone).', inline: false },
                { name: `\`${PREFIX}automods\``, value: 'Déploie les règles natives AutoMod Discord (anti-mention spam, anti-invitations).', inline: false },
                { name: `\`${PREFIX}autopublish [#salon|all|off]\``, value: 'Publie automatiquement les messages postés dans les salons d\'annonces.', inline: false },
                { name: `\`${PREFIX}autoreact <#salon> <emojis...>\``, value: 'Ajoute automatiquement des réactions sous chaque message envoyé.', inline: false },
                { name: `\`${PREFIX}captcha setup <#salon> <@role>\``, value: 'Active un portail de vérification anti-double compte par captcha.', inline: false },
                { name: `\`${PREFIX}counter\``, value: 'Crée des salons vocaux compteurs en direct de membres et vocaux.', inline: false },
                { name: `\`${PREFIX}change <cmd> <role/perm>\``, value: 'Modifie la permission requise pour exécuter une commande.', inline: false },
                { name: `\`${PREFIX}listoff\``, value: 'Liste les commandes désactivées sur le serveur.', inline: false },
                { name: `\`${PREFIX}hidereply [on|off]\``, value: 'Rend invisibles les messages de refus de permissions.', inline: false },
                { name: `\`${PREFIX}theme <#couleur/nom>\``, value: 'Modifie la couleur dominante de tous les embeds du bot.', inline: false },
                { name: `\`${PREFIX}prefix / ${PREFIX}mainprefix <prefix>\``, value: 'Modifie le préfixe du bot.', inline: false }
            ]
        },
        security: {
            title: '🔒 Module : Salons & Sécurité Anti-Raid',
            description: 'Verrouillage de salon et blindage du serveur contre le raid, les bots malveillants et le flood.',
            fields: [
                { name: `\`${PREFIX}antiraid\` ou \`${PREFIX}securite\``, value: 'Ouvre le Dashboard interactif Anti-Raid avec boutons de contrôle en temps réel.', inline: false },
                { name: `\`${PREFIX}antispam <on|off>\``, value: 'Bloque et sanctionne les membres envoyant du flood rapide (5+ msg/5s).', inline: false },
                { name: `\`${PREFIX}antilink <on|off>\``, value: 'Supprime automatiquement les liens d\'invitation Discord non autorisés.', inline: false },
                { name: `\`${PREFIX}antibot <on|off>\``, value: 'Expulse immédiatement les bots non certifiés ajoutés au serveur.', inline: false },
                { name: `\`${PREFIX}antimention <on|off> [max]\``, value: 'Bloque et mute les membres effectuant des mentions massives.', inline: false },
                { name: `\`${PREFIX}antichannel <on|off>\``, value: 'Active la protection contre la suppression ou création sauvage de salons.', inline: false },
                { name: `\`${PREFIX}antirole <on|off>\``, value: 'Active la protection contre la suppression de rôles.', inline: false },
                { name: `\`${PREFIX}antiban <on|off>\``, value: 'Détecte et bloque les tentatives de mass-ban par un staff corrompu.', inline: false },
                { name: `\`${PREFIX}lock [salon]\``, value: 'Empêche l\'envoi de messages dans le salon ciblé.', inline: false },
                { name: `\`${PREFIX}unlock [salon]\``, value: 'Rétablit l\'autorisation d\'écriture dans le salon.', inline: false },
                { name: `\`${PREFIX}hide / ${PREFIX}unhide [salon]\``, value: 'Masque ou affiche un salon pour les membres.', inline: false },
                { name: `\`${PREFIX}renew\``, value: 'Recrée à l\'identique le salon actuel (purge totale instantanée).', inline: false },
                { name: `\`${PREFIX}slowmode <secondes>\``, value: 'Règle le délai de temporisation entre les messages.', inline: false }
            ]
        },
        utility: {
            title: '📊 Module : Informations & Utilitaires',
            description: 'Inspection système, statistiques et communication.',
            fields: [
                { name: `\`${PREFIX}serverinfo\``, value: 'Affiche les caractéristiques détaillées du serveur.', inline: false },
                { name: `\`${PREFIX}userinfo [@user]\``, value: 'Affiche les données détaillées d\'un utilisateur.', inline: false },
                { name: `\`${PREFIX}avatar [@user]\``, value: 'Affiche l\'avatar en haute résolution.', inline: false },
                { name: `\`${PREFIX}banner [@user]\``, value: 'Affiche la bannière de profil d\'un utilisateur.', inline: false },
                { name: `\`${PREFIX}botinfo\``, value: 'Consommation RAM, ping WebSocket et uptime.', inline: false },
                { name: `\`${PREFIX}poll <question>\``, value: 'Lance un sondage rapide interactif (réactions auto).', inline: false },
                { name: `\`${PREFIX}say <message>\``, value: 'Diffuse une annonce officielle sobre et encadrée.', inline: false }
            ]
        }
    };

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('📂 Naviguer dans les modules...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Accueil')
                    .setDescription('Vue globale du système')
                    .setValue('home')
                    .setEmoji('⚡'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Modération & Sanctions')
                    .setDescription('Ban, kick, mutes, avertissements, notes')
                    .setValue('moderation')
                    .setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ghost-Join Automatique')
                    .setDescription('Pings fantômes discrets à l\'arrivée')
                    .setValue('ghostjoin')
                    .setEmoji('👻'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Rôles & Attribution Massive')
                    .setDescription('Autorole, massivrole, derank')
                    .setValue('roles')
                    .setEmoji('🎭'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Système de Bienvenue')
                    .setDescription('Message personnalisé et salon d\'accueil')
                    .setValue('welcome')
                    .setEmoji('👋'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Tickets Personnalisables')
                    .setDescription('Catégories, motifs, rôle et salons')
                    .setValue('tickets')
                    .setEmoji('🎫'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Hiérarchie & Blacklist')
                    .setDescription('Owners, buyers, managers et blacklist')
                    .setValue('hierarchy')
                    .setEmoji('👑'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Logs & Traçabilité')
                    .setDescription('Autologs, mod, messages, vocaux, etc.')
                    .setValue('logs')
                    .setEmoji('📁'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Automatisation & Système')
                    .setDescription('Autoperm, automods, captcha, counter, etc.')
                    .setValue('automation')
                    .setEmoji('⚡'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Salons & Anti-Raid')
                    .setDescription('Lock, hide, renew, protection automatique')
                    .setValue('security')
                    .setEmoji('🔒'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Utilitaires & Stats')
                    .setDescription('Infos serveur, profil, avatar, sondages')
                    .setValue('utility')
                    .setEmoji('📊')
            )
    );

    return { categories, menu };
};

// ─── INITIALISATION CLIENT ────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`[SUPREME-GESTION] Initialisé. Connecté sous ${client.user.tag}`);
    console.log(`[DATABASE] Données persistantes synchronisées avec ${DATA_FILE}`);
    client.user.setPresence({
        activities: [{ name: `${db.prefix || PREFIX}help · Supreme Gestion`, type: 3 }],
        status: 'online'
    });

    // Mise à jour périodique des compteurs de membres / vocaux (+counter)
    setInterval(() => {
        for (const guild of client.guilds.cache.values()) {
            updateServerCounters(guild);
        }
    }, 5 * 60 * 1000);
});

// ─── ÉVÉNEMENT : NOUVEAU MEMBRE (Auto-Rôle + Ghost-Join + Welcome) ────────
client.on('guildMemberAdd', async (member) => {
    // 0. Sécurité Blacklist Globale
    if (db.blacklist && db.blacklist.includes(member.id)) {
        await member.ban({ reason: '[Supreme Blacklist] Membre inscrit sur la blacklist globale du bot' }).catch(() => {});
        console.log(`[BLACKLIST] Tentative d'entrée d'un membre blacklisté bloquée : ${member.user.tag} (${member.id})`);
        return;
    }

    // 0.1 Sécurité Anti-Bot : Expulsion automatique des bots non autorisés
    if (member.user.bot && db.antiRaid.active && db.antiRaid.antiBot) {
        try {
            await member.kick('Anti-Raid : Bot non autorisé');
            console.log(`[ANTI-BOT] Bot non autorisé expulsé : ${member.user.tag} (${member.id})`);
            return;
        } catch (e) {
            console.error('[ANTI-BOT] Impossible d\'expulser le bot:', e.message);
        }
    }

    // 1. Attribution automatique de l'Auto-Rôle si configuré
    if (db.autoRoleId) {
        const autoRole = member.guild.roles.cache.get(db.autoRoleId);
        if (autoRole && autoRole.editable) {
            await member.roles.add(autoRole).catch(() => {});
        }
    }

    // 2. Ghost-Join : Ghost-Ping dans les salons configurés (envoi + suppression immédiate)
    if (db.ghostJoinConfig.enabled && db.ghostJoinConfig.channels && db.ghostJoinConfig.channels.length > 0) {
        for (const channelId of db.ghostJoinConfig.channels) {
            const targetChannel = member.guild.channels.cache.get(channelId);
            if (targetChannel && targetChannel.isTextBased()) {
                targetChannel.send(`<@${member.id}>`)
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 250))
                    .catch(() => {});
            }
        }
    }

    // 3. Message de Bienvenue
    if (db.welcomeConfig.enabled && db.welcomeConfig.channelId) {
        const channel = member.guild.channels.cache.get(db.welcomeConfig.channelId);
        if (channel) {
            const messageToSend = formatWelcomeMessage(db.welcomeConfig.message, member);
            await channel.send(messageToSend).catch(() => {});
        }
    }

    // 4. Surveillance BLRank au join (révocation immédiate si rôles persistants)
    const userBl = db.blacklistedRoles[member.id];
    if (userBl && userBl.length > 0) {
        const forbiddenRoles = member.roles.cache.filter(r => userBl.includes(r.id) && r.editable);
        if (forbiddenRoles.size > 0) {
            await member.roles.remove(forbiddenRoles, 'BLRank : Rôles interdits au join').catch(() => {});
        }
    }

    // 5. Mise à jour des compteurs dynamiques (+counter)
    updateServerCounters(member.guild);
});

// ─── ÉVÉNEMENT : DÉPART DE MEMBRE (Mise à jour compteurs) ─────────────────
client.on('guildMemberRemove', async (member) => {
    updateServerCounters(member.guild);
});

// ─── ÉVÉNEMENT : INTERCEPTION EN DIRECT BLRANK & LOGS (guildMemberUpdate) ──
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // A. Détection des rôles ajoutés ou retirés (Logs + BLRank)
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    const userBl = db.blacklistedRoles[newMember.id];
    if (userBl && userBl.length > 0) {
        for (const [roleId, role] of addedRoles) {
            if (userBl.includes(roleId) && role.editable) {
                try {
                    await newMember.roles.remove(role, 'BLRank : Rôle interdit pour ce membre');
                    console.log(`[BLRANK] Rôle "${role.name}" (${role.id}) révoqué d'office pour ${newMember.user.tag}`);
                } catch (err) {
                    console.error('[BLRANK] Erreur révocation rôle blacklisté:', err.message);
                }
            }
        }
    }

    // B. Logs des rôles (+rolelogs)
    if (addedRoles.size > 0 || removedRoles.size > 0) {
        const fields = [];
        if (addedRoles.size > 0) {
            fields.push({ name: '➕ Rôles ajoutés', value: addedRoles.map(r => `${r} (\`${r.id}\`)`).join(', ') });
        }
        if (removedRoles.size > 0) {
            fields.push({ name: '➖ Rôles retirés', value: removedRoles.map(r => `${r} (\`${r.id}\`)`).join(', ') });
        }
        sendLog(newMember.guild, 'role', makeEmbed({
            color: COLORS.CYAN,
            title: '🎭 Rôles Membre Modifiés',
            description: `Les rôles de ${newMember} (\`${newMember.id}\`) ont été modifiés.`,
            fields
        }));
    }

    // C. Logs de Boost (+boostlogs)
    if (!oldMember.premiumSince && newMember.premiumSince) {
        sendLog(newMember.guild, 'boost', makeEmbed({
            color: COLORS.PURPLE,
            title: '🚀 Nouveau Boost de Serveur !',
            description: `${newMember} vient de booster le serveur ! Merci à lui.`
        }));
    }
});

// ─── FILTRE ANTI-RAID / ANTI-LINK / ANTI-SPAM AUTOMATISÉ ──────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (db.antiRaid.active && !isStaff(message.member)) {
        if (db.antiRaid.antiLink) {
            const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
            if (inviteRegex.test(message.content)) {
                await message.delete().catch(() => {});
                const warningMsg = await message.channel.send({
                    embeds: [makeEmbed({
                        color: COLORS.DANGER,
                        title: '🛡️ Sécurité Anti-Lien',
                        description: `${message.author}, les invitations externes sont interdites.`
                    })]
                });
                setTimeout(() => warningMsg.delete().catch(() => {}), 4000);

                sendLog(message.guild, 'raid', makeEmbed({
                    color: COLORS.DANGER,
                    title: '🚨 Anti-Raid : Lien d\'invitation bloqué',
                    description: `Message de ${message.author} (\`${message.author.id}\`) supprimé dans ${message.channel}.`
                }));
                return;
            }
        }

        if (db.antiRaid.antiMention && message.mentions.users.size > db.antiRaid.maxMentions) {
            await message.delete().catch(() => {});
            await message.member.timeout(10 * 60 * 1000, 'Anti-Raid : Mass Mention').catch(() => {});
            const alertMsg = await message.channel.send({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '🚨 Détection Mass-Mention',
                    description: `${message.author} a été sanctionné (Timeout 10m).`
                })]
            });
            setTimeout(() => alertMsg.delete().catch(() => {}), 5000);

            sendLog(message.guild, 'raid', makeEmbed({
                color: COLORS.DANGER,
                title: '🚨 Anti-Raid : Mass-Mention sanctionné',
                description: `${message.author} (\`${message.author.id}\`) a envoyé plus de ${db.antiRaid.maxMentions} mentions dans ${message.channel}. Exclu 10m.`
            }));
            return;
        }

        if (db.antiRaid.antiSpam) {
            const now = Date.now();
            const userTimestamps = db.userMessageTimestamps.get(message.author.id) || [];
            const recent = userTimestamps.filter(t => now - t < 5000);
            recent.push(now);
            db.userMessageTimestamps.set(message.author.id, recent);

            if (recent.length >= 6) {
                await message.delete().catch(() => {});
                await message.member.timeout(5 * 60 * 1000, 'Anti-Raid : Flood / Spam').catch(() => {});
                db.userMessageTimestamps.delete(message.author.id);

                sendLog(message.guild, 'raid', makeEmbed({
                    color: COLORS.DANGER,
                    title: '🚨 Anti-Raid : Spam / Flood sanctionné',
                    description: `${message.author} (\`${message.author.id}\`) a été exclu 5 minutes pour flood rapide dans ${message.channel}.`
                }));
                return;
            }
        }
    }
});

// ─── MODULES DE SÉCURITÉ COMPLÉMENTAIRES & LOGS SANCTIONS / ROLES / VOCAUX ───
const recentStaffBans = new Map();
client.on('guildBanAdd', async (ban) => {
    sendLog(ban.guild, 'mod', makeEmbed({
        color: COLORS.DANGER,
        title: '🔨 Membre Banni du Serveur',
        description: `L'utilisateur **${ban.user.tag}** (\`${ban.user.id}\`) a été banni du serveur.`
    }));

    if (!ban.guild || !db.antiRaid.active || !db.antiRaid.antiBan) return;
    try {
        const audit = await ban.guild.fetchAuditLogs({ type: 22 /* MEMBER_BAN_ADD */, limit: 1 }).catch(() => null);
        const entry = audit?.entries.first();
        if (entry && entry.executor && entry.executor.id !== client.user.id && entry.executor.id !== ban.guild.ownerId) {
            const now = Date.now();
            const timestamps = (recentStaffBans.get(entry.executor.id) || []).filter(t => now - t < 15000);
            timestamps.push(now);
            recentStaffBans.set(entry.executor.id, timestamps);

            if (timestamps.length >= 3) {
                const staffMember = await ban.guild.members.fetch(entry.executor.id).catch(() => null);
                if (staffMember && staffMember.bannable) {
                    await staffMember.roles.set([], 'Anti-Raid : Détection Mass-Ban').catch(() => {});
                    console.warn(`[ANTI-MASSBAN] Rôles révoqués pour ${entry.executor.tag} suite à un raid de bans.`);
                    sendLog(ban.guild, 'raid', makeEmbed({
                        color: COLORS.DANGER,
                        title: '🚨 Anti-Raid : Mass-Ban bloqué d\'urgence',
                        description: `Rôles révoqués pour **${entry.executor.tag}** suite à un enchaînement anormal de bannissements.`
                    }));
                }
            }
        }
    } catch (e) {}
});

client.on('guildBanRemove', async (ban) => {
    sendLog(ban.guild, 'mod', makeEmbed({
        color: COLORS.SUCCESS,
        title: '🔓 Membre Débanni du Serveur',
        description: `L'utilisateur **${ban.user.tag}** (\`${ban.user.id}\`) a été débanni du serveur.`
    }));
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    sendLog(channel.guild, 'raid', makeEmbed({
        color: COLORS.WARNING,
        title: '📁 Salon Supprimé',
        description: `Le salon **${channel.name}** a été supprimé.`
    }));
    if (!db.antiRaid.active || !db.antiRaid.antiChannel) return;
    try {
        const audit = await channel.guild.fetchAuditLogs({ type: 12 /* CHANNEL_DELETE */, limit: 1 }).catch(() => null);
        const entry = audit?.entries.first();
        if (entry && entry.executor && entry.executor.id !== client.user.id && entry.executor.id !== channel.guild.ownerId) {
            console.warn(`[ANTI-CHANNEL] Salon "${channel.name}" supprimé par ${entry.executor.tag}`);
        }
    } catch (e) {}
});

client.on('roleCreate', async (role) => {
    sendLog(role.guild, 'role', makeEmbed({
        color: COLORS.SUCCESS,
        title: '🎭 Rôle Créé',
        description: `Le rôle **${role.name}** (\`${role.id}\`) a été créé.`
    }));
});

client.on('roleDelete', async (role) => {
    sendLog(role.guild, 'role', makeEmbed({
        color: COLORS.DANGER,
        title: '🗑️ Rôle Supprimé',
        description: `Le rôle **${role.name}** (\`${role.id}\`) a été supprimé.`
    }));
    if (!role.guild || !db.antiRaid.active || !db.antiRaid.antiRole) return;
    try {
        const audit = await role.guild.fetchAuditLogs({ type: 32 /* ROLE_DELETE */, limit: 1 }).catch(() => null);
        const entry = audit?.entries.first();
        if (entry && entry.executor && entry.executor.id !== client.user.id && entry.executor.id !== role.guild.ownerId) {
            console.warn(`[ANTI-ROLE] Rôle "${role.name}" supprimé par ${entry.executor.tag}`);
        }
    } catch (e) {}
});

// Logs de suppression de messages (+msglogs)
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    sendLog(message.guild, 'msg', makeEmbed({
        color: COLORS.DANGER,
        title: '🗑️ Message Supprimé',
        description: `Un message de ${message.author} a été supprimé dans ${message.channel}.`,
        fields: [
            { name: 'Contenu', value: message.content ? message.content.slice(0, 1024) : '*(Aucun contenu texte / média)*' }
        ]
    }));
});

// Logs de modification de messages (+msglogs)
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    sendLog(newMessage.guild, 'msg', makeEmbed({
        color: COLORS.WARNING,
        title: '✏️ Message Modifié',
        description: `Message de ${newMessage.author} édité dans ${newMessage.channel}.`,
        fields: [
            { name: 'Ancien contenu', value: oldMessage.content ? oldMessage.content.slice(0, 1024) : '*(Non mis en cache)*' },
            { name: 'Nouveau contenu', value: newMessage.content ? newMessage.content.slice(0, 1024) : '*(Vide)*' }
        ]
    }));
});

// Logs vocaux (+voicelogs)
client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member || member.user.bot) return;

    // Mise à jour live des compteurs si configurés
    updateServerCounters(guild);

    if (!oldState.channelId && newState.channelId) {
        sendLog(guild, 'voice', makeEmbed({
            color: COLORS.SUCCESS,
            title: '🔊 Connexion Vocale',
            description: `${member} s'est connecté au salon vocal <#${newState.channelId}>.`
        }));
    } else if (oldState.channelId && !newState.channelId) {
        sendLog(guild, 'voice', makeEmbed({
            color: COLORS.DANGER,
            title: '🔇 Déconnexion Vocale',
            description: `${member} a quitté le salon vocal <#${oldState.channelId}>.`
        }));
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        sendLog(guild, 'voice', makeEmbed({
            color: COLORS.CYAN,
            title: '🔄 Déplacement Vocal',
            description: `${member} s'est déplacé de <#${oldState.channelId}> vers <#${newState.channelId}>.`
        }));
    }
});

// ─── GESTION DES INTERACTIONS : GHOST-JOIN, WELCOME, AUTOROLE, TICKETS, CAPTCHA ────
client.on('interactionCreate', async (interaction) => {
    // ═══════════════════════════════════════════════════════════════════════
    // CAPTCHA : INTERACTION DE VÉRIFICATION (+captcha)
    // ═══════════════════════════════════════════════════════════════════════
    if (interaction.isButton() && interaction.customId === 'captcha_verify_btn') {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        captchaCodes.set(interaction.user.id, code);

        const modal = new ModalBuilder()
            .setCustomId('captcha_modal_submit')
            .setTitle(`Sécurité Captcha : ${code}`);

        const codeInput = new TextInputBuilder()
            .setCustomId('captcha_input_code')
            .setLabel(`Tapez le code suivant : [ ${code} ]`)
            .setPlaceholder(code)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(4)
            .setMaxLength(6);

        modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'captcha_modal_submit') {
        const expected = captchaCodes.get(interaction.user.id);
        const entered = interaction.fields.getTextInputValue('captcha_input_code').trim().toUpperCase();

        if (expected && entered === expected) {
            captchaCodes.delete(interaction.user.id);
            if (db.captchaConfig.roleId) {
                const role = interaction.guild.roles.cache.get(db.captchaConfig.roleId);
                if (role && role.editable) {
                    await interaction.member.roles.add(role).catch(() => {});
                }
            }

            sendLog(interaction.guild, 'captcha', makeEmbed({
                color: COLORS.SUCCESS,
                title: '🤖 Captcha Réussi',
                description: `${interaction.user} (\`${interaction.user.id}\`) a complété la vérification captcha avec succès.`
            }));

            return interaction.reply({
                content: '✅ **Vérification réussie avec succès !** Bienvenue sur le serveur, votre rôle vous a été attribué.',
                ephemeral: true
            });
        } else {
            sendLog(interaction.guild, 'captcha', makeEmbed({
                color: COLORS.DANGER,
                title: '🤖 Captcha Échoué',
                description: `${interaction.user} (\`${interaction.user.id}\`) a échoué au test Captcha (Attendu: \`${expected}\`, Reçu: \`${entered}\`).`
            }));

            return interaction.reply({
                content: '❌ **Code Captcha erroné !** Veuillez recliquer sur le bouton pour générer un nouveau code.',
                ephemeral: true
            });
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // A. INTERACTIONS GHOST-JOIN (+set ghostjoin)
    // ═══════════════════════════════════════════════════════════════════════

    // 1. Sélection multi-salons de Ghost-Join
    if (interaction.isChannelSelectMenu() && interaction.customId === 'ghostjoin_select_channels') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '⛔ Accès refusé.', ephemeral: true });
        }
        db.ghostJoinConfig.channels = interaction.values;
        saveData();

        const updated = buildGhostJoinEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // 2. Boutons d'action du panneau Ghost-Join
    if (interaction.isButton() && interaction.customId.startsWith('ghostjoin_btn_')) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '⛔ Accès refusé.', ephemeral: true });
        }

        // Toggle Activer/Désactiver
        if (interaction.customId === 'ghostjoin_btn_toggle') {
            db.ghostJoinConfig.enabled = !db.ghostJoinConfig.enabled;
            saveData();

            const updated = buildGhostJoinEmbed(interaction.guild);
            return interaction.update({ embeds: [updated.embed], components: updated.components });
        }

        // Vider les salons
        if (interaction.customId === 'ghostjoin_btn_clear') {
            db.ghostJoinConfig.channels = [];
            saveData();

            const updated = buildGhostJoinEmbed(interaction.guild);
            return interaction.update({ embeds: [updated.embed], components: updated.components });
        }

        // Tester le Ghost-Join
        if (interaction.customId === 'ghostjoin_btn_test') {
            if (!db.ghostJoinConfig.channels || db.ghostJoinConfig.channels.length === 0) {
                return interaction.reply({ content: '⚠️ Aucun salon sélectionné.', ephemeral: true });
            }

            for (const chId of db.ghostJoinConfig.channels) {
                const ch = interaction.guild.channels.cache.get(chId);
                if (ch && ch.isTextBased()) {
                    ch.send(`<@${interaction.user.id}>`)
                        .then(m => setTimeout(() => m.delete().catch(() => {}), 250))
                        .catch(() => {});
                }
            }

            return interaction.reply({
                content: `👻 **Test Ghost-Join exécuté avec succès dans ${db.ghostJoinConfig.channels.length} salon(s) !** (Mention envoyée et supprimée)`,
                ephemeral: true
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // B. INTERACTIONS AUTOROLE (+set autorole)
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isRoleSelectMenu() && interaction.customId === 'autorole_select_role') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: '⛔ Accès refusé.', ephemeral: true });
        }
        const selectedId = interaction.values[0];
        db.autoRoleId = selectedId;
        saveData();

        return interaction.update({
            content: `✅ Auto-Rôle configuré et sauvegardé sur <@&${selectedId}>.`,
            components: []
        });
    }

    if (interaction.isButton() && interaction.customId === 'autorole_btn_disable') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: '⛔ Accès refusé.', ephemeral: true });
        }
        db.autoRoleId = null;
        saveData();

        const updated = buildAutoRoleEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // C. INTERACTIONS DU MODULE BIENVENUE (+set welcome)
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && interaction.customId.startsWith('wlc_btn_')) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '⛔ Accès réservé aux gestionnaires du serveur.', ephemeral: true });
        }

        if (interaction.customId === 'wlc_btn_channel') {
            const channelSelect = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('wlc_select_channel')
                    .setPlaceholder('📢 Choisissez le salon pour les messages de bienvenue...')
                    .setChannelTypes(ChannelType.GuildText)
            );
            return interaction.reply({
                content: '📢 **Sélectionnez le salon textuel où accueillir les nouveaux arrivants :**',
                components: [channelSelect],
                ephemeral: true
            });
        }

        if (interaction.customId === 'wlc_btn_edit_msg') {
            const modal = new ModalBuilder()
                .setCustomId('modal_edit_welcome_msg')
                .setTitle('Modifier le message de bienvenue');

            const msgInput = new TextInputBuilder()
                .setCustomId('wlc_text_input')
                .setLabel('Texte du message ({user}, {server}, {count})')
                .setValue(db.welcomeConfig.message)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'wlc_btn_toggle') {
            db.welcomeConfig.enabled = !db.welcomeConfig.enabled;
            saveData();
            const updated = buildWelcomeConfigEmbed(interaction.guild, interaction.member);
            return interaction.update({ embeds: [updated.embed], components: [updated.actionRow] });
        }

        if (interaction.customId === 'wlc_btn_test') {
            if (!db.welcomeConfig.channelId) {
                return interaction.reply({ content: '⚠️ Veuillez d\'abord définir un salon avec le bouton "Définir Salon".', ephemeral: true });
            }

            const chan = interaction.guild.channels.cache.get(db.welcomeConfig.channelId);
            if (!chan) return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });

            const testMessage = formatWelcomeMessage(db.welcomeConfig.message, interaction.member);
            await chan.send(testMessage);

            return interaction.reply({
                content: `🧪 **Test envoyé avec succès dans <#${chan.id}> !**`,
                ephemeral: true
            });
        }

        if (interaction.customId === 'wlc_btn_reset') {
            db.welcomeConfig.message = DEFAULT_WELCOME_MESSAGE;
            saveData();
            const updated = buildWelcomeConfigEmbed(interaction.guild, interaction.member);
            return interaction.update({ embeds: [updated.embed], components: [updated.actionRow] });
        }
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'wlc_select_channel') {
        const selectedId = interaction.values[0];
        db.welcomeConfig.channelId = selectedId;
        saveData();
        return interaction.update({
            content: `✅ Salon d'accueil sauvegardé sur <#${selectedId}>.`,
            components: []
        });
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_edit_welcome_msg') {
        const newMsg = interaction.fields.getTextInputValue('wlc_text_input').trim();
        db.welcomeConfig.message = newMsg || DEFAULT_WELCOME_MESSAGE;
        saveData();

        const preview = formatWelcomeMessage(db.welcomeConfig.message, interaction.member);
        return interaction.reply({
            content: `✅ **Message de bienvenue mis à jour et sauvegardé sur disque !**\n\n**Aperçu :**\n${preview}`,
            ephemeral: true
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // D. PANEL DE CONFIGURATION DES TICKETS & MODALS
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && interaction.customId.startsWith('cfg_btn_')) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '⛔ Accès réservé aux administrateurs.', ephemeral: true });
        }

        if (interaction.customId === 'cfg_btn_add_category') {
            const modal = new ModalBuilder()
                .setCustomId('modal_add_ticket_category')
                .setTitle('Ajouter un motif de ticket');

            const emojiInput = new TextInputBuilder()
                .setCustomId('cat_emoji')
                .setLabel('Emoji représentatif')
                .setPlaceholder('Exemple : 📨, 🚨, 🤝, 💎')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(10)
                .setRequired(true);

            const labelInput = new TextInputBuilder()
                .setCustomId('cat_label')
                .setLabel('Nom du motif / catégorie')
                .setPlaceholder('Exemple : Support Général, Signalement, etc.')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(80)
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('cat_desc')
                .setLabel('Description explicative')
                .setPlaceholder('Exemple : Aide générale, questions diverses')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(100)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(emojiInput),
                new ActionRowBuilder().addComponents(labelInput),
                new ActionRowBuilder().addComponents(descInput)
            );

            return interaction.showModal(modal);
        }

        if (interaction.customId === 'cfg_btn_del_category') {
            if (db.ticketConfig.categories.length === 0) {
                return interaction.reply({ content: '⚠️ Aucune catégorie à supprimer.', ephemeral: true });
            }

            const delSelect = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cfg_select_del_category')
                    .setPlaceholder('Sélectionnez la catégorie à supprimer...')
                    .addOptions(db.ticketConfig.categories.map(c => ({
                        label: c.label,
                        description: c.description.slice(0, 100),
                        value: c.id,
                        emoji: c.emoji
                    })))
            );

            return interaction.reply({
                content: '➖ **Choisissez la catégorie que vous souhaitez retirer du panel :**',
                components: [delSelect],
                ephemeral: true
            });
        }

        if (interaction.customId === 'cfg_btn_reset_categories') {
            db.ticketConfig.categories = [
                { id: 'general', emoji: '📨', label: 'Support Général', description: 'Aide générale, questions diverses' },
                { id: 'report', emoji: '🚨', label: 'Plainte & Signalement', description: 'Signaler un membre ou un abus' },
                { id: 'partnership', emoji: '🤝', label: 'Partenariats', description: 'Proposer une collaboration' },
                { id: 'billing', emoji: '💎', label: 'Boutique & Rôles', description: 'Renseignements rôles VIP et boutique' }
            ];
            saveData();
            const updated = buildTicketConfigEmbed(interaction.guild);
            await interaction.update({ embeds: [updated.embed], components: updated.components });
            return interaction.followUp({ content: '📋 Les catégories par défaut ont été restaurées et sauvegardées.', ephemeral: true });
        }

        if (interaction.customId === 'cfg_btn_category') {
            const options = [
                new StringSelectMenuOptionBuilder()
                    .setLabel('🌍 Catégorie Discord par Défaut (Globale)')
                    .setDescription('Catégorie utilisée par défaut pour tous les motifs')
                    .setValue('global')
                    .setEmoji('🌐')
            ];

            for (const cat of db.ticketConfig.categories) {
                const currentChan = cat.categoryId ? interaction.guild.channels.cache.get(cat.categoryId)?.name : null;
                const desc = currentChan ? `Actuel : 📁 ${currentChan}` : 'Aucune catégorie dédiée (utilise le défaut)';
                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${cat.emoji} ${cat.label}`.slice(0, 100))
                        .setDescription(desc.slice(0, 100))
                        .setValue(cat.id)
                        .setEmoji(cat.emoji.length <= 4 ? cat.emoji : '📁')
                );
            }

            const motifSelectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cfg_choose_ticket_motif_for_category')
                    .setPlaceholder('🎯 Sélectionnez le motif de ticket à configurer...')
                    .addOptions(options)
            );

            return interaction.reply({
                content: '📁 **Étape 1/2 : Pour quel motif de ticket souhaitez-vous assigner un salon catégorie Discord ?**\n*Sélectionnez ci-dessous un motif précis pour séparer ses tickets, ou la catégorie globale.*',
                components: [motifSelectRow],
                ephemeral: true
            });
        }

        if (interaction.customId === 'cfg_btn_role') {
            const roleSelect = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('cfg_select_role')
                    .setPlaceholder('🛡️ Sélectionnez le rôle de votre équipe support...')
            );
            return interaction.reply({
                content: '🛡️ **Choisissez le rôle ayant accès aux tickets de support :**',
                components: [roleSelect],
                ephemeral: true
            });
        }

        if (interaction.customId === 'cfg_btn_logs') {
            const logsSelect = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('cfg_select_logs')
                    .setPlaceholder('📜 Sélectionnez le salon où archiver les logs...')
                    .setChannelTypes(ChannelType.GuildText)
            );
            return interaction.reply({
                content: '📜 **Choisissez le salon textuel pour les rapports d\'activité des tickets :**',
                components: [logsSelect],
                ephemeral: true
            });
        }

        if (interaction.customId === 'cfg_btn_deploy') {
            const deploySelect = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('cfg_select_deploy_channel')
                    .setPlaceholder('🚀 Sélectionnez le salon où publier le panel...')
                    .setChannelTypes(ChannelType.GuildText)
            );
            return interaction.reply({
                content: '🚀 **Dans quel salon textuel souhaitez-vous envoyer le message de création de ticket ?**',
                components: [deploySelect],
                ephemeral: true
            });
        }

        if (interaction.customId === 'cfg_btn_reset') {
            db.ticketConfig = {
                categoryId: null,
                staffRoleId: null,
                logsChannelId: null,
                panelChannelId: null,
                categories: [
                    { id: 'general', emoji: '📨', label: 'Support Général', description: 'Aide générale, questions diverses' },
                    { id: 'report', emoji: '🚨', label: 'Plainte & Signalement', description: 'Signaler un membre ou un abus' },
                    { id: 'partnership', emoji: '🤝', label: 'Partenariats', description: 'Proposer une collaboration' },
                    { id: 'billing', emoji: '💎', label: 'Boutique & Rôles', description: 'Renseignements rôles VIP et boutique' }
                ]
            };
            saveData();
            const updated = buildTicketConfigEmbed(interaction.guild);
            await interaction.update({ embeds: [updated.embed], components: updated.components });
            return interaction.followUp({ content: '🔄 La configuration globale des tickets a été réinitialisée et sauvegardée.', ephemeral: true });
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_ticket_category') {
        const emoji = interaction.fields.getTextInputValue('cat_emoji').trim() || '🎫';
        const label = interaction.fields.getTextInputValue('cat_label').trim();
        const description = interaction.fields.getTextInputValue('cat_desc').trim();
        const id = `cat_${Date.now()}`;

        db.ticketConfig.categories.push({ id, emoji, label, description });
        saveData();

        return interaction.reply({
            content: `✅ Nouvelle catégorie ajoutée et enregistrée : ${emoji} **${label}** (*${description}*) !`,
            ephemeral: true
        });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_select_del_category') {
        const toDeleteId = interaction.values[0];
        const removed = db.ticketConfig.categories.find(c => c.id === toDeleteId);
        db.ticketConfig.categories = db.ticketConfig.categories.filter(c => c.id !== toDeleteId);
        saveData();

        return interaction.update({
            content: `🗑️ Catégorie **${removed?.label || toDeleteId}** supprimée avec succès.`,
            components: []
        });
    }

    // Étape 1 : Choix du motif pour assigner une catégorie Discord
    if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_choose_ticket_motif_for_category') {
        const chosenMotifId = interaction.values[0];
        let targetLabel = 'la catégorie globale par défaut';
        let currentChanText = db.ticketConfig.categoryId ? `<#${db.ticketConfig.categoryId}>` : '`Aucune`';

        if (chosenMotifId !== 'global') {
            const cat = db.ticketConfig.categories.find(c => c.id === chosenMotifId);
            if (cat) {
                targetLabel = `le motif « ${cat.emoji} **${cat.label}** »`;
                currentChanText = cat.categoryId ? `<#${cat.categoryId}>` : (db.ticketConfig.categoryId ? `<#${db.ticketConfig.categoryId}> *(défaut)*` : '`Aucune`');
            }
        }

        const categoryChannelSelect = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId(`cfg_select_discord_category_${chosenMotifId}`)
                .setPlaceholder('📁 Sélectionnez la catégorie Discord où créer ces tickets...')
                .setChannelTypes(ChannelType.GuildCategory)
        );

        const resetBtnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cfg_btn_clear_cat_${chosenMotifId}`)
                .setLabel('Réinitialiser (Utiliser le défaut)')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

        return interaction.update({
            content: `📁 **Étape 2/2 : Choisissez la catégorie Discord hôte pour ${targetLabel} :**\n*Catégorie actuelle : ${currentChanText}*`,
            components: [categoryChannelSelect, resetBtnRow]
        });
    }

    // Étape 2 : Enregistrement de la catégorie Discord hôte choisie
    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('cfg_select_discord_category_')) {
        const targetMotifId = interaction.customId.replace('cfg_select_discord_category_', '');
        const selectedDiscordCategoryId = interaction.values[0];

        let motifName = 'Globale (Défaut)';
        if (targetMotifId === 'global') {
            db.ticketConfig.categoryId = selectedDiscordCategoryId;
        } else {
            const cat = db.ticketConfig.categories.find(c => c.id === targetMotifId);
            if (cat) {
                cat.categoryId = selectedDiscordCategoryId;
                motifName = `${cat.emoji} ${cat.label}`;
            }
        }
        saveData();

        return interaction.update({
            content: `✅ **Catégorie Discord assignée avec succès !**\nLes tickets **${motifName}** seront désormais créés dans <#${selectedDiscordCategoryId}>.`,
            components: []
        });
    }

    // Réinitialisation de la catégorie d'un motif spécifique
    if (interaction.isButton() && interaction.customId.startsWith('cfg_btn_clear_cat_')) {
        const targetMotifId = interaction.customId.replace('cfg_btn_clear_cat_', '');
        let motifName = 'Globale';
        if (targetMotifId === 'global') {
            db.ticketConfig.categoryId = null;
        } else {
            const cat = db.ticketConfig.categories.find(c => c.id === targetMotifId);
            if (cat) {
                delete cat.categoryId;
                motifName = `${cat.emoji} ${cat.label}`;
            }
        }
        saveData();

        return interaction.update({
            content: `🗑️ **Catégorie dédiée réinitialisée pour « ${motifName} » !**\nCe motif utilisera désormais la catégorie Discord globale par défaut.`,
            components: []
        });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'cfg_select_category') {
        db.ticketConfig.categoryId = interaction.values[0];
        saveData();
        return interaction.update({ content: `✅ Catégorie des salons enregistrée sur <#${interaction.values[0]}>.`, components: [] });
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === 'cfg_select_role') {
        db.ticketConfig.staffRoleId = interaction.values[0];
        saveData();
        return interaction.update({ content: `✅ Rôle Support enregistré sur <@&${interaction.values[0]}>.`, components: [] });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'cfg_select_logs') {
        db.ticketConfig.logsChannelId = interaction.values[0];
        saveData();
        return interaction.update({ content: `✅ Salon de logs enregistré sur <#${interaction.values[0]}>.`, components: [] });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'cfg_select_deploy_channel') {
        const targetChannelId = interaction.values[0];
        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        if (!targetChannel) return interaction.update({ content: '❌ Salon introuvable.', components: [] });

        const { embed, selectMenu } = generateTicketPublicPanel(interaction.guild);
        await targetChannel.send({ embeds: [embed], components: [selectMenu] });

        db.ticketConfig.panelChannelId = targetChannelId;
        saveData();
        return interaction.update({ content: `✅ Panneau déployé avec succès dans <#${targetChannelId}> et sauvegardé !`, components: [] });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // E. GESTION DES TICKETS CÔTÉ MEMBRE (Création, Fermeture, Claim)
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_category') {
        const categoryKey = interaction.values[0];
        const category = db.ticketConfig.categories.find(c => c.id === categoryKey) || {
            label: 'Support Général',
            emoji: '📨',
            description: 'Assistance'
        };

        const existingTicket = Array.from(db.openTickets.entries()).find(([_, data]) => data.authorId === interaction.user.id);
        if (existingTicket) {
            return interaction.reply({
                content: `⚠️ Vous avez déjà un ticket ouvert dans le salon <#${existingTicket[0]}>.`,
                ephemeral: true
            });
        }

        db.ticketCount++;
        const paddedCount = String(db.ticketCount).padStart(4, '0');
        const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${paddedCount}`;

        const permissionOverwrites = [
            {
                id: interaction.guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.AttachFiles,
                    PermissionsBitField.Flags.EmbedLinks
                ]
            },
            {
                id: client.user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            }
        ];

        if (db.ticketConfig.staffRoleId) {
            permissionOverwrites.push({
                id: db.ticketConfig.staffRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.AttachFiles,
                    PermissionsBitField.Flags.EmbedLinks
                ]
            });
        }

        try {
            const createOptions = {
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites
            };

            const targetParentCategory = category.categoryId || db.ticketConfig.categoryId;
            if (targetParentCategory) {
                createOptions.parent = targetParentCategory;
            }

            const ticketChannel = await interaction.guild.channels.create(createOptions);

            db.openTickets.set(ticketChannel.id, {
                authorId: interaction.user.id,
                category: category.label,
                claimedBy: null,
                createdAt: new Date().toISOString()
            });
            saveData();

            const ticketEmbed = new EmbedBuilder()
                .setColor(COLORS.CYAN)
                .setTitle(`🎫 Ticket #${paddedCount} · ${category.emoji} ${category.label}`)
                .setDescription([
                    `Bonjour ${interaction.user}, bienvenue dans votre salon d'assistance privée.`,
                    ``,
                    `> **Catégorie :** \`${category.label}\``,
                    `> **Demandeur :** ${interaction.user.tag} (\`${interaction.user.id}\`)`,
                    `> **Équipe assignée :** ${db.ticketConfig.staffRoleId ? `<@&${db.ticketConfig.staffRoleId}>` : '`Personnel d\'administration`'}`,
                    ``,
                    `Merci de détailler précisément l'objet de votre demande afin qu'un membre du personnel puisse vous répondre au plus vite.`
                ].join('\n'))
                .setFooter({ text: 'Supreme Management · Support Client' })
                .setTimestamp();

            const actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close_btn')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('ticket_claim_btn')
                    .setLabel('Prendre en charge (Claim)')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✋')
            );

            const staffMention = db.ticketConfig.staffRoleId ? `<@&${db.ticketConfig.staffRoleId}>` : '';
            await ticketChannel.send({
                content: `${interaction.user} ${staffMention}`,
                embeds: [ticketEmbed],
                components: [actionButtons]
            });

            if (db.ticketConfig.logsChannelId) {
                const logsChan = interaction.guild.channels.cache.get(db.ticketConfig.logsChannelId);
                if (logsChan) {
                    logsChan.send({
                        embeds: [makeEmbed({
                            color: COLORS.SUCCESS,
                            title: '📥 Nouveau Ticket Ouvert',
                            fields: [
                                { name: 'Salon', value: `${ticketChannel}`, inline: true },
                                { name: 'Auteur', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Motif', value: `${category.emoji} ${category.label}`, inline: true }
                            ]
                        })].filter(Boolean)
                    }).catch(() => {});
                }
            }

            return interaction.reply({
                content: `✅ Votre ticket a été créé avec succès : ${ticketChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Erreur création ticket :', error);
            return interaction.reply({
                content: '❌ Impossible de créer le salon de ticket. Vérifiez les permissions de mon rôle.',
                ephemeral: true
            });
        }
    }

    if (interaction.isButton()) {
        const ticketData = db.openTickets.get(interaction.channel.id);

        if (interaction.customId === 'ticket_close_btn') {
            await interaction.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '🔒 Fermeture du Ticket',
                    description: `Fermeture validée par ${interaction.user}.\nSuppression du salon dans **5 secondes**...`
                })]
            });

            if (db.ticketConfig.logsChannelId) {
                const logsChan = interaction.guild.channels.cache.get(db.ticketConfig.logsChannelId);
                if (logsChan) {
                    logsChan.send({
                        embeds: [makeEmbed({
                            color: COLORS.DANGER,
                            title: '🔒 Ticket Fermé & Supprimé',
                            fields: [
                                { name: 'Salon fermé', value: `\`${interaction.channel.name}\``, inline: true },
                                { name: 'Fermé par', value: `${interaction.user.tag}`, inline: true },
                                { name: 'Auteur original', value: ticketData ? `<@${ticketData.authorId}>` : 'Inconnu', inline: true }
                            ]
                        })]
                    }).catch(() => {});
                }
            }

            setTimeout(async () => {
                db.openTickets.delete(interaction.channel.id);
                saveData();
                await interaction.channel.delete().catch(() => {});
            }, 5000);
            return;
        }

        if (interaction.customId === 'ticket_claim_btn') {
            if (!isStaff(interaction.member)) {
                return interaction.reply({
                    content: '⛔ Seul un membre du personnel autorisé peut prendre en charge ce ticket.',
                    ephemeral: true
                });
            }

            if (ticketData && ticketData.claimedBy) {
                return interaction.reply({
                    content: `⚠️ Ce ticket est déjà pris en charge par <@${ticketData.claimedBy}>.`,
                    ephemeral: true
                });
            }

            if (ticketData) {
                ticketData.claimedBy = interaction.user.id;
                saveData();
            }

            await interaction.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '✋ Prise en Charge Enregistrée',
                    description: `Ce ticket est désormais géré par ${interaction.user}.`
                })]
            });

            if (db.ticketConfig.logsChannelId) {
                const logsChan = interaction.guild.channels.cache.get(db.ticketConfig.logsChannelId);
                if (logsChan) {
                    logsChan.send({
                        embeds: [makeEmbed({
                            color: COLORS.PRIMARY,
                            title: '✋ Ticket Pris en Charge',
                            description: `Le salon ${interaction.channel} est désormais assigné à ${interaction.user}.`
                        })]
                    }).catch(() => {});
                }
            }
            return;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // E. INTERACTIONS DES RÔLES (+set addrole, +set delrole, +set derank)
    // ═══════════════════════════════════════════════════════════════════════

    // Bouton commun de fermeture de panel
    if (interaction.isButton() && interaction.customId === 'panel_btn_close') {
        return interaction.message.delete().catch(() => {
            interaction.update({ content: '🔒 Panneau fermé.', embeds: [], components: [] });
        });
    }

    // 1. +set addrole : Sélection du rôle
    if (interaction.isRoleSelectMenu() && interaction.customId === 'set_addrole_select_role') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.addRole = interaction.values[0];
        saveData();

        const updated = buildAddRoleConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // +set addrole : Reset
    if (interaction.isButton() && interaction.customId === 'set_addrole_btn_reset') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.addRole = null;
        saveData();

        const updated = buildAddRoleConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // 2. +set delrole : Sélection du rôle
    if (interaction.isRoleSelectMenu() && interaction.customId === 'set_delrole_select_role') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.delRole = interaction.values[0];
        saveData();

        const updated = buildDelRoleConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // +set delrole : Reset
    if (interaction.isButton() && interaction.customId === 'set_delrole_btn_reset') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.delRole = null;
        saveData();

        const updated = buildDelRoleConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // 3. +set derank : Rôle Autorisé
    if (interaction.isRoleSelectMenu() && interaction.customId === 'set_derank_select_allowed') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.derankAllowed = interaction.values[0];
        saveData();

        const updated = buildDerankConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // +set derank : Rôle Protégé (Non retiré)
    if (interaction.isRoleSelectMenu() && interaction.customId === 'set_derank_select_protected') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.derankProtected = interaction.values[0];
        saveData();

        const updated = buildDerankConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // +set derank : Vider Rôle Protégé (retirer tout)
    if (interaction.isButton() && interaction.customId === 'set_derank_btn_clear_protected') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.derankProtected = null;
        saveData();

        const updated = buildDerankConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // +set derank : Reset Rôle Autorisé
    if (interaction.isButton() && interaction.customId === 'set_derank_btn_reset_allowed') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }
        db.rolePerms.derankAllowed = null;
        saveData();

        const updated = buildDerankConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // F. INTERACTIONS DU DASHBOARD ANTI-RAID (+antiraid / +securite)
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && interaction.customId.startsWith('antiraid_toggle_')) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Accès refusé. Permission Administrateur requise.', ephemeral: true });
        }

        const action = interaction.customId.replace('antiraid_toggle_', '');
        if (action === 'link') db.antiRaid.antiLink = !db.antiRaid.antiLink;
        else if (action === 'spam') db.antiRaid.antiSpam = !db.antiRaid.antiSpam;
        else if (action === 'bot') db.antiRaid.antiBot = !db.antiRaid.antiBot;
        else if (action === 'mention') db.antiRaid.antiMention = !db.antiRaid.antiMention;
        else if (action === 'channel') db.antiRaid.antiChannel = !db.antiRaid.antiChannel;
        else if (action === 'role') db.antiRaid.antiRole = !db.antiRaid.antiRole;
        else if (action === 'ban') db.antiRaid.antiBan = !db.antiRaid.antiBan;
        else if (action === 'global') {
            db.antiRaid.active = !db.antiRaid.active;
        }

        saveData();
        const updated = buildAntiRaidConfigEmbed(interaction.guild);
        return interaction.update({ embeds: [updated.embed], components: updated.components });
    }
});

// ─── ROUTAGE DES COMMANDES (+PREFIX & DYNAMIQUES) ─────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 0. Sécurité Blacklist Globale (ignore toute interaction)
    if (db.blacklist && db.blacklist.includes(message.author.id)) {
        return;
    }

    // 1. Auto-Publish (+autopublish) pour les salons d'annonces
    if (message.channel.type === ChannelType.GuildAnnouncement) {
        if (db.autoPublish && (db.autoPublish.includes(message.channel.id) || db.autoPublish.includes('all'))) {
            message.crosspost().catch(() => {});
        }
    }

    // 2. Auto-React (+autoreact)
    if (db.autoReact && db.autoReact[message.channel.id]) {
        const emojis = db.autoReact[message.channel.id];
        for (const emoji of emojis) {
            await message.react(emoji).catch(() => {});
        }
    }

    // 3. Détection et extraction du préfixe (+mainprefix / +prefix)
    const currentPrefix = db.prefix || PREFIX;
    let usedPrefix = null;
    if (message.content.startsWith(currentPrefix)) {
        usedPrefix = currentPrefix;
    } else if (message.content.startsWith(PREFIX)) {
        usedPrefix = PREFIX;
    }
    if (!usedPrefix) return;

    const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    // 4. Vérification commandes désactivées (+listoff)
    if (db.disabledCommands && db.disabledCommands.includes(cmd)) {
        if (!isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, `La commande \`${cmd}\` est actuellement désactivée sur ce serveur.`);
        }
    }

    // 5. Vérification des permissions personnalisées (+change)
    if (db.commandPerms && db.commandPerms[cmd]) {
        const targetPermOrRole = db.commandPerms[cmd];
        const hasRole = message.member.roles.cache.has(targetPermOrRole);
        const hasPerm = PermissionsBitField.Flags[targetPermOrRole] && message.member.permissions.has(PermissionsBitField.Flags[targetPermOrRole]);
        if (!hasRole && !hasPerm && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, `Cette commande requiert le rôle ou la permission \`${targetPermOrRole}\`.`);
        }
    }

    // ─── COMMANDE : HELP ──────────────────────────────────────────────────
    if (cmd === 'help') {
        const { categories, menu } = generateHelpData();
        const initialEmbed = makeEmbed({
            color: COLORS.PRIMARY,
            title: categories.home.title,
            description: categories.home.description,
            fields: categories.home.fields,
            thumbnail: client.user.displayAvatarURL()
        });

        const replyMessage = await message.reply({
            embeds: [initialEmbed],
            components: [menu]
        });

        const collector = replyMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 120000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: 'Seul l\'auteur de la commande peut naviguer.', ephemeral: true });
            }

            const chosen = interaction.values[0];
            const data = categories[chosen] || categories.home;

            const updatedEmbed = makeEmbed({
                color: chosen === 'home' ? COLORS.PRIMARY : COLORS.CYAN,
                title: data.title,
                description: data.description,
                fields: data.fields,
                thumbnail: client.user.displayAvatarURL()
            });

            await interaction.update({ embeds: [updatedEmbed], components: [menu] });
        });

        collector.on('end', () => {
            replyMessage.edit({ components: [] }).catch(() => {});
        });
        return;
    }

    // ─── COMMANDE : +set ghostjoin / +ghostjoin ───────────────────────────
    if ((cmd === 'set' && args[0]?.toLowerCase() === 'ghostjoin') || cmd === 'ghostjoin') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `MANAGE_GUILD` requise.' })] });
        }

        const sub = (cmd === 'set' ? args[1] : args[0])?.toLowerCase();

        // 1. Activer ou Désactiver via texte
        if (sub === 'off' || sub === 'disable') {
            db.ghostJoinConfig.enabled = false;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '👻 Ghost-Join Désactivé', description: 'Le module de Ghost-Ping automatique est mis en pause.' })] });
        }

        if (sub === 'on' || sub === 'enable') {
            db.ghostJoinConfig.enabled = true;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '👻 Ghost-Join Activé', description: 'Le module de Ghost-Ping automatique est maintenant actif.' })] });
        }

        // 2. Définition directe de salons par mentions (#salon1 #salon2 ...)
        const mentionedChannels = message.mentions.channels.filter(c => c.type === ChannelType.GuildText);
        if (mentionedChannels.size > 0) {
            db.ghostJoinConfig.channels = Array.from(mentionedChannels.keys());
            db.ghostJoinConfig.enabled = true;
            saveData();

            const chanList = Array.from(mentionedChannels.values()).map(c => `${c}`).join(' ');
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '👻 Salons Ghost-Join Configurés',
                    description: `Salons enregistrés (${mentionedChannels.size}) :\n${chanList}\n\n💾 **Persistant dans \`data.json\`**`
                })]
            });
        }

        // 3. Sans argument : ouverture du panneau de configuration stylé
        const panel = buildGhostJoinEmbed(message.guild);
        return message.reply({ embeds: [panel.embed], components: panel.components });
    }

    // ─── COMMANDE : +set autorole / +autorole ─────────────────────────────
    if ((cmd === 'set' && args[0]?.toLowerCase() === 'autorole') || cmd === 'autorole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `MANAGE_ROLES` requise.' })] });
        }

        const roleArg = cmd === 'set' ? args[1] : args[0];

        if (roleArg && (roleArg.toLowerCase() === 'off' || roleArg.toLowerCase() === 'disable')) {
            db.autoRoleId = null;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🎭 Auto-Rôle Désactivé', description: 'L\'attribution automatique a été désactivée.' })] });
        }

        if (roleArg) {
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(roleArg);
            if (!role) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Rôle Introuvable', description: `Aucun rôle trouvé pour "${roleArg}".` })] });
            }

            if (!role.editable) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie Insuffisante', description: `Mon rôle doit être situé plus haut que ${role} dans la liste des rôles.` })] });
            }

            db.autoRoleId = role.id;
            saveData();

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '🎭 Auto-Rôle Configuré',
                    description: `Le rôle ${role} sera automatiquement attribué à chaque nouvelle arrivée.\n💾 **Enregistré dans \`data.json\`**`
                })]
            });
        }

        const panel = buildAutoRoleEmbed(message.guild);
        return message.reply({ embeds: [panel.embed], components: panel.components });
    }

    // ─── COMMANDE : +massivrole <id_rôle ou mention> ──────────────────────
    if (cmd === 'massivrole' || cmd === 'massrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise pour l\'attribution massive.' })] });
        }

        const targetArg = args[0];
        if (!targetArg) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}massivrole <id_du_rôle ou @rôle>\`` })] });
        }

        const role = message.mentions.roles.first() || message.guild.roles.cache.get(targetArg);
        if (!role) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Rôle Introuvable', description: `Impossible de trouver un rôle pour \`${targetArg}\`.` })] });
        }

        if (!role.editable) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie Insuffisante', description: `Le rôle **@${role.name}** (\`${role.id}\`) est placé plus haut ou égal au mien.` })] });
        }

        const statusMsg = await message.reply({
            embeds: [makeEmbed({
                color: COLORS.PRIMARY,
                title: '⚡ Attribution Massive en Cours...',
                description: `Scan de l'ensemble des membres pour le rôle **@${role.name}** (\`${role.id}\`)...`
            })],
            allowedMentions: { roles: [] }
        });

        const members = await message.guild.members.fetch();
        const targets = members.filter(m => !m.roles.cache.has(role.id));

        if (targets.size === 0) {
            return statusMsg.edit({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '✅ Rôle Déjà Détenu',
                    description: `Tous les membres (${members.size}) possèdent déjà le rôle **@${role.name}** (\`${role.id}\`).`
                })],
                allowedMentions: { roles: [] }
            });
        }

        let assignedCount = 0;
        let failCount = 0;
        const total = targets.size;

        for (const [_, member] of targets) {
            try {
                await member.roles.add(role);
                assignedCount++;
            } catch {
                failCount++;
            }
            await new Promise(r => setTimeout(r, 40));
        }

        return statusMsg.edit({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🎉 Attribution Massive Terminée',
                description: [
                    `Opération exécutée par ${message.author}.`,
                    ``,
                    `> 🎭 **Rôle attribué :** **@${role.name}** (\`${role.id}\`)`,
                    `> ✅ **Membres actualisés :** **${assignedCount}** / ${total}`,
                    `> ⏭️ **Membres ayant déjà le rôle :** **${members.size - total}**`,
                    `> ⚠️ **Échecs :** ${failCount}`
                ].join('\n')
            })],
            allowedMentions: { roles: [] }
        });
    }

    // ─── COMMANDE : SET WELCOME (+set welcome [#salon] [message]) ──────────
    if (cmd === 'set' && args[0]?.toLowerCase() === 'welcome') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `MANAGE_GUILD` requise.' })] });
        }

        const targetChannel = message.mentions.channels.first();

        if (!targetChannel && args.length <= 1) {
            const configPanel = buildWelcomeConfigEmbed(message.guild, message.member);
            return message.reply({
                embeds: [configPanel.embed],
                components: [configPanel.actionRow]
            });
        }

        if (targetChannel) {
            db.welcomeConfig.channelId = targetChannel.id;
            db.welcomeConfig.enabled = true;

            const customMsgParts = args.slice(2).join(' ').trim();
            if (customMsgParts.length > 0) {
                db.welcomeConfig.message = customMsgParts;
            } else {
                db.welcomeConfig.message = DEFAULT_WELCOME_MESSAGE;
            }

            saveData();
            const preview = formatWelcomeMessage(db.welcomeConfig.message, message.member);

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '👋 Système de Bienvenue Sauvegardé',
                    description: [
                        `Le salon d'accueil a été défini sur ${targetChannel} et sauvegardé sur disque.`,
                        ``,
                        `### 💬 Rendu avec les vraies données de votre serveur :`,
                        preview,
                        ``,
                        `*Le message sera envoyé automatiquement à chaque nouvelle arrivée.*`
                    ].join('\n')
                })]
            });
        }
    }

    if (cmd === 'welcome' || cmd === 'setwelcome') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        }

        const configPanel = buildWelcomeConfigEmbed(message.guild, message.member);
        return message.reply({
            embeds: [configPanel.embed],
            components: [configPanel.actionRow]
        });
    }

    // ─── COMMANDE : +rename <nouveau nom> ─────────────────────────────────
    if (cmd === 'rename' || (cmd === 'ticket' && (args[0]?.toLowerCase() === 'rename' || args[0]?.toLowerCase() === 'renommer'))) {
        const ticketData = db.openTickets.get(message.channel.id);
        const isTicketChannel = ticketData || message.channel.name.toLowerCase().startsWith('ticket-');

        if (!isTicketChannel) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Salon Invalide',
                    description: 'La commande `+rename` ne peut être utilisée que dans un salon de ticket ouvert.'
                })]
            });
        }

        if (!isStaff(message.member) && (!ticketData || ticketData.authorId !== message.author.id)) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '⛔ Accès refusé',
                    description: 'Seul l\'auteur du ticket ou un membre de l\'équipe staff peut renommer ce ticket.'
                })]
            });
        }

        const rawArgs = cmd === 'rename' ? args : args.slice(1);
        const rawNewName = rawArgs.join(' ').trim();

        if (!rawNewName) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}rename <nouveau nom>\`\nExemple : \`${PREFIX}rename support-urgent\` ou \`${PREFIX}rename ${message.author.username}-aide\``
                })]
            });
        }

        let cleanName = rawNewName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_]/g, '')
            .slice(0, 100);

        if (!cleanName) {
            cleanName = `ticket-${Date.now().toString().slice(-4)}`;
        }

        const oldName = message.channel.name;

        try {
            await message.channel.setName(cleanName);

            const successEmbed = makeEmbed({
                color: COLORS.SUCCESS,
                title: '✏️ Ticket Renommé',
                description: `Le ticket a été renommé avec succès par ${message.author}.`,
                fields: [
                    { name: 'Ancien nom', value: `\`${oldName}\``, inline: true },
                    { name: 'Nouveau nom', value: `\`${cleanName}\``, inline: true }
                ]
            });

            await message.reply({ embeds: [successEmbed] });

            if (db.ticketConfig.logsChannelId) {
                const logsChan = message.guild.channels.cache.get(db.ticketConfig.logsChannelId);
                if (logsChan) {
                    logsChan.send({
                        embeds: [makeEmbed({
                            color: COLORS.CYAN,
                            title: '✏️ Ticket Renommé',
                            fields: [
                                { name: 'Salon', value: `<#${message.channel.id}> (\`${cleanName}\`)`, inline: true },
                                { name: 'Renommé par', value: `${message.author.tag} (${message.author})`, inline: true },
                                { name: 'Auteur original', value: ticketData ? `<@${ticketData.authorId}>` : 'Inconnu', inline: true }
                            ]
                        })]
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[TICKET] Erreur lors du renommage du salon:', err);
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '⚠️ Limite Discord atteinte',
                    description: 'Discord limite les renommages de salons (maximum 2 fois par 10 minutes par salon). Veuillez patienter quelques minutes avant de réessayer.'
                })]
            });
        }
        return;
    }

    // ─── COMMANDE : +close [raison] ───────────────────────────────────────
    if (cmd === 'close' || (cmd === 'ticket' && (args[0]?.toLowerCase() === 'close' || args[0]?.toLowerCase() === 'fermer'))) {
        const ticketData = db.openTickets.get(message.channel.id);
        const isTicketChannel = ticketData || message.channel.name.toLowerCase().startsWith('ticket-');

        if (!isTicketChannel) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Salon Invalide',
                    description: 'La commande `+close` ne peut être utilisée que dans un salon de ticket ouvert.'
                })]
            });
        }

        if (!isStaff(message.member) && (!ticketData || ticketData.authorId !== message.author.id)) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '⛔ Accès refusé',
                    description: 'Seul l\'auteur du ticket ou un membre de l\'équipe staff peut fermer ce ticket.'
                })]
            });
        }

        const rawArgs = cmd === 'close' ? args : args.slice(1);
        const reason = rawArgs.join(' ').trim() || 'Fermé par commande';

        await message.reply({
            embeds: [makeEmbed({
                color: COLORS.DANGER,
                title: '🔒 Fermeture du Ticket',
                description: `Fermeture demandée par ${message.author}.\n**Raison :** ${reason}\n\nSuppression du salon dans **5 secondes**...`
            })]
        });

        if (db.ticketConfig.logsChannelId) {
            const logsChan = message.guild.channels.cache.get(db.ticketConfig.logsChannelId);
            if (logsChan) {
                logsChan.send({
                    embeds: [makeEmbed({
                        color: COLORS.DANGER,
                        title: '🔒 Ticket Fermé & Supprimé',
                        fields: [
                            { name: 'Salon fermé', value: `\`${message.channel.name}\``, inline: true },
                            { name: 'Fermé par', value: `${message.author.tag}`, inline: true },
                            { name: 'Raison', value: reason, inline: true },
                            { name: 'Auteur original', value: ticketData ? `<@${ticketData.authorId}>` : 'Inconnu', inline: true }
                        ]
                    })]
                }).catch(() => {});
            }
        }

        setTimeout(async () => {
            db.openTickets.delete(message.channel.id);
            saveData();
            await message.channel.delete().catch(() => {});
        }, 5000);
        return;
    }

    // ─── COMMANDE : +add <@membre/id> (Ajoute un membre au ticket) ────────
    if (cmd === 'add' || (cmd === 'ticket' && args[0]?.toLowerCase() === 'add')) {
        const ticketData = db.openTickets.get(message.channel.id);
        const isTicketChannel = ticketData || message.channel.name.toLowerCase().startsWith('ticket-');

        if (!isTicketChannel) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Salon Invalide',
                    description: 'La commande `+add` ne peut être utilisée que dans un salon de ticket ouvert.'
                })]
            });
        }

        if (!isStaff(message.member) && (!ticketData || ticketData.authorId !== message.author.id)) {
            return replyPermissionDenied(message, 'Seul l\'auteur du ticket ou un membre du personnel autorisé peut ajouter un membre.');
        }

        const rawArgs = cmd === 'add' ? args : args.slice(1);
        const targetMember = message.mentions.members.first() || (rawArgs[0] ? await message.guild.members.fetch(rawArgs[0].replace(/[<@!>]/g, '')).catch(() => null) : null);

        if (!targetMember) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}add <@membre | ID>\`\nExemple : \`${PREFIX}add @User\``
                })]
            });
        }

        try {
            await message.channel.permissionOverwrites.edit(targetMember, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true
            });

            const successEmbed = makeEmbed({
                color: COLORS.SUCCESS,
                title: '➕ Membre Ajouté au Ticket',
                description: `${targetMember} a été invité dans le ticket par ${message.author}.`
            });
            await message.reply({ embeds: [successEmbed] });

            if (db.ticketConfig.logsChannelId) {
                const logsChan = message.guild.channels.cache.get(db.ticketConfig.logsChannelId);
                if (logsChan) {
                    logsChan.send({
                        embeds: [makeEmbed({
                            color: COLORS.CYAN,
                            title: '➕ Membre Ajouté au Ticket',
                            fields: [
                                { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Membre ajouté', value: `${targetMember} (\`${targetMember.id}\`)`, inline: true },
                                { name: 'Ajouté par', value: `${message.author.tag}`, inline: true }
                            ]
                        })]
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[TICKET] Erreur lors de l\'ajout du membre:', err);
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '❌ Erreur',
                    description: 'Impossible d\'ajouter ce membre (vérifiez mes permissions sur le salon).'
                })]
            });
        }
        return;
    }

    // ─── COMMANDE : +del <@membre/id> (Retire un membre du ticket) ────────
    if (cmd === 'del' || (cmd === 'ticket' && args[0]?.toLowerCase() === 'del')) {
        const ticketData = db.openTickets.get(message.channel.id);
        const isTicketChannel = ticketData || message.channel.name.toLowerCase().startsWith('ticket-');

        if (!isTicketChannel) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Salon Invalide',
                    description: 'La commande `+del` ne peut être utilisée que dans un salon de ticket ouvert.'
                })]
            });
        }

        if (!isStaff(message.member) && (!ticketData || ticketData.authorId !== message.author.id)) {
            return replyPermissionDenied(message, 'Seul l\'auteur du ticket ou un membre du personnel autorisé peut retirer un membre.');
        }

        const rawArgs = cmd === 'del' ? args : args.slice(1);
        const targetMember = message.mentions.members.first() || (rawArgs[0] ? await message.guild.members.fetch(rawArgs[0].replace(/[<@!>]/g, '')).catch(() => null) : null);

        if (!targetMember) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}del <@membre | ID>\`\nExemple : \`${PREFIX}del @User\``
                })]
            });
        }

        try {
            await message.channel.permissionOverwrites.delete(targetMember);

            const successEmbed = makeEmbed({
                color: COLORS.SUCCESS,
                title: '➖ Membre Retiré du Ticket',
                description: `${targetMember} a été retiré du ticket par ${message.author}.`
            });
            await message.reply({ embeds: [successEmbed] });

            if (db.ticketConfig.logsChannelId) {
                const logsChan = message.guild.channels.cache.get(db.ticketConfig.logsChannelId);
                if (logsChan) {
                    logsChan.send({
                        embeds: [makeEmbed({
                            color: COLORS.WARNING,
                            title: '➖ Membre Retiré du Ticket',
                            fields: [
                                { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Membre retiré', value: `${targetMember} (\`${targetMember.id}\`)`, inline: true },
                                { name: 'Retiré par', value: `${message.author.tag}`, inline: true }
                            ]
                        })]
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[TICKET] Erreur lors du retrait du membre:', err);
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '❌ Erreur',
                    description: 'Impossible de retirer ce membre.'
                })]
            });
        }
        return;
    }

    // ─── COMMANDE : TICKET & GESTION DES CATÉGORIES ───────────────────────
    if (cmd === 'ticket' || cmd === 'tickets') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'addcat' || sub === 'addcategory') {
            const raw = args.slice(1).join(' ');
            const parts = raw.split('|');
            if (parts.length < 2) {
                return message.reply({
                    embeds: [makeEmbed({
                        color: COLORS.WARNING,
                        title: '⚠️ Syntaxe',
                        description: `Usage : \`${PREFIX}ticket addcat <emoji> <Nom de la catégorie> | <Description>\`\nExemple : \`${PREFIX}ticket addcat 💼 Recrutement | Postuler dans le staff\``
                    })]
                });
            }

            const firstPart = parts[0].trim().split(/ +/);
            const emoji = firstPart.shift();
            const label = firstPart.join(' ');
            const description = parts[1].trim();

            if (!emoji || !label || !description) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Données manquantes', description: 'Vérifiez l\'emoji, le nom et la description.' })] });
            }

            db.ticketConfig.categories.push({ id: `cat_${Date.now()}`, emoji, label, description });
            saveData();

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '✅ Catégorie Ajoutée & Sauvegardée',
                    description: `Catégorie enregistrée : ${emoji} **${label}**\n*${description}*`
                })]
            });
        }

        if (sub === 'delcat' || sub === 'delcategory') {
            const search = args.slice(1).join(' ').toLowerCase();
            if (!search) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}ticket delcat <nom_de_la_catégorie>\`` })] });
            }

            const initialLength = db.ticketConfig.categories.length;
            db.ticketConfig.categories = db.ticketConfig.categories.filter(c => !c.label.toLowerCase().includes(search));

            if (db.ticketConfig.categories.length === initialLength) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Introuvable', description: `Aucune catégorie ne correspond à "${search}".` })] });
            }

            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🗑️ Catégorie Supprimée', description: `La catégorie correspondante a été retirée et sauvegardée sur disque.` })] });
        }

        if (sub === 'listcat' || sub === 'categories') {
            const list = db.ticketConfig.categories.map((c, i) => {
                const discCat = c.categoryId ? `<#${c.categoryId}>` : (db.ticketConfig.categoryId ? `<#${db.ticketConfig.categoryId}> *(défaut)*` : '`Non configurée`');
                return `\`${i + 1}.\` ${c.emoji} **${c.label}** : *${c.description}*\n   ↳ 📁 **Catégorie Discord :** ${discCat}`;
            }).join('\n') || 'Aucune catégorie configurée.';
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.PRIMARY,
                    title: '📋 Catégories de Ticket Actives',
                    description: list
                })]
            });
        }

        if (sub === 'setcat' || sub === 'setcategory') {
            const catSearch = args[1]?.toLowerCase();
            const discCatId = args[2]?.replace(/[<#>]/g, '');

            if (!catSearch || !discCatId) {
                return message.reply({
                    embeds: [makeEmbed({
                        color: COLORS.WARNING,
                        title: '⚠️ Syntaxe de la commande',
                        description: `Usage : \`${PREFIX}ticket setcat <nom_motif> <id_catégorie_discord>\`\n` +
                                     `Exemple : \`${PREFIX}ticket setcat support 1567990545979146240\`\n` +
                                     `Pour réinitialiser sur le défaut global : \`${PREFIX}ticket setcat <nom_motif> none\``
                    })]
                });
            }

            const targetCat = db.ticketConfig.categories.find(c => c.label.toLowerCase().includes(catSearch));
            if (!targetCat) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Motif introuvable', description: `Aucun motif de ticket ne correspond à "${catSearch}".` })] });
            }

            if (discCatId === 'none' || discCatId === 'clear' || discCatId === 'reset') {
                delete targetCat.categoryId;
                saveData();
                return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔄 Catégorie Réinitialisée', description: `Le motif **${targetCat.emoji} ${targetCat.label}** utilisera désormais la catégorie Discord globale par défaut.` })] });
            }

            const discordChannel = message.guild.channels.cache.get(discCatId);
            if (!discordChannel || discordChannel.type !== ChannelType.GuildCategory) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Catégorie invalide', description: `L'ID fourni (\`${discCatId}\`) n'est pas une catégorie de salons Discord valide sur ce serveur.` })] });
            }

            targetCat.categoryId = discCatId;
            saveData();

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '📁 Catégorie Discord Assignée',
                    description: `Les tickets du motif **${targetCat.emoji} ${targetCat.label}** seront désormais créés dans **${discordChannel.name}** (\`${discCatId}\`).`
                })]
            });
        }

        if (sub === 'send' || sub === 'deploy') {
            const target = message.mentions.channels.first() || message.channel;
            const { embed, selectMenu } = generateTicketPublicPanel(message.guild);
            await target.send({ embeds: [embed], components: [selectMenu] });
            db.ticketConfig.panelChannelId = target.id;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🚀 Panel Déployé', description: `Le panneau public d'ouverture de tickets est actif dans ${target}.` })] });
        }

        if (sub === 'reset') {
            db.ticketConfig = {
                categoryId: null,
                staffRoleId: null,
                logsChannelId: null,
                panelChannelId: null,
                categories: [
                    { id: 'general', emoji: '📨', label: 'Support Général', description: 'Aide générale, questions diverses' },
                    { id: 'report', emoji: '🚨', label: 'Plainte & Signalement', description: 'Signaler un membre ou un abus' },
                    { id: 'partnership', emoji: '🤝', label: 'Partenariats', description: 'Proposer une collaboration' },
                    { id: 'billing', emoji: '💎', label: 'Boutique & Rôles', description: 'Renseignements rôles VIP et boutique' }
                ]
            };
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔄 Reset Effectué', description: 'Paramètres et catégories des tickets réinitialisés.' })] });
        }

        const configPanel = buildTicketConfigEmbed(message.guild);
        return message.reply({
            embeds: [configPanel.embed],
            components: configPanel.components
        });
    }

    // ─── MODÉRATION : BAN / TEMPBAN / UNBAN ───────────────────────────────
    if (cmd === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `BAN_MEMBERS` requise.' })] });
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}ban @membre [raison]\`` })] });
        if (!target.bannable) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Erreur', description: 'Action impossible sur ce membre.' })] });

        const reason = args.slice(1).join(' ') || 'Non spécifiée';
        await target.ban({ reason: `[SupremeBot] ${reason} - Par ${message.author.tag}` });
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🔨 Bannissement Appliqué',
                description: `**Cible :** ${target.user.tag} (\`${target.id}\`)\n**Modérateur :** ${message.author}\n**Raison :** ${reason}`
            })]
        });
    }

    if (cmd === 'tempban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        }
        const target = message.mentions.members.first();
        const durationMin = parseInt(args[1], 10);
        if (!target || isNaN(durationMin) || durationMin <= 0) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}tempban @membre <minutes> [raison]\`` })] });
        }
        if (!target.bannable) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Erreur', description: 'Action impossible sur ce membre.' })] });

        const reason = args.slice(2).join(' ') || 'Non spécifiée';
        const userId = target.id;
        await target.ban({ reason: `[TempBan ${durationMin}m] ${reason}` });

        message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '⏱️ Bannissement Temporaire',
                description: `**Cible :** ${target.user.tag}\n**Durée :** ${durationMin} minute(s)\n**Raison :** ${reason}`
            })]
        });

        setTimeout(async () => {
            await message.guild.members.unban(userId, 'Expiration TempBan').catch(() => {});
        }, durationMin * 60 * 1000);
        return;
    }

    if (cmd === 'unban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        }
        const id = args[0];
        if (!id) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}unban <id_utilisateur>\`` })] });

        try {
            await message.guild.members.unban(id);
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔓 Débannissement Réussi', description: `L'identifiant \`${id}\` a été débanni.` })] });
        } catch {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Introuvable', description: 'Aucun bannissement actif pour cet identifiant.' })] });
        }
    }

    // ─── MODÉRATION : KICK / MUTE / UNMUTE ────────────────────────────────
    if (cmd === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}kick @membre [raison]\`` })] });
        if (!target.kickable) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Erreur', description: 'Impossible d\'expulser ce membre.' })] });

        const reason = args.slice(1).join(' ') || 'Non spécifiée';
        await target.kick(reason);
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '👢 Expulsion Effectuée',
                description: `**Membre :** ${target.user.tag}\n**Modérateur :** ${message.author}\n**Raison :** ${reason}`
            })]
        });
    }

    if (cmd === 'mute' || cmd === 'tempmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        }
        const target = message.mentions.members.first();
        const durationMin = parseInt(args[1], 10);
        if (!target || isNaN(durationMin) || durationMin <= 0) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}mute @membre <minutes> [raison]\`` })] });
        }
        if (!target.moderatable) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Erreur', description: 'Action impossible sur ce membre.' })] });

        const reason = args.slice(2).join(' ') || 'Non spécifiée';
        await target.timeout(durationMin * 60 * 1000, reason);
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🔇 Exclusion Appliquée',
                description: `**Membre :** ${target.user.tag}\n**Durée :** ${durationMin} minute(s)\n**Modérateur :** ${message.author}\n**Raison :** ${reason}`
            })]
        });
    }

    if (cmd === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}unmute @membre\`` })] });

        await target.timeout(null);
        return message.reply({
            embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔊 Mute Révoqué', description: `La parole a été rétablie pour ${target.user.tag}.` })]
        });
    }

    // ─── AVERTISSEMENTS & DOSSIERS STAFF ──────────────────────────────────
    if (cmd === 'warn') {
        if (!isStaff(message.member)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission modérateur requise.' })] });
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(' ');
        if (!target || !reason) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}warn @membre <raison>\`` })] });

        const userWarns = db.warnings.get(target.id) || [];
        userWarns.push({ reason, moderator: message.author.tag, date: new Date().toLocaleString('fr-FR') });
        db.warnings.set(target.id, userWarns);
        saveData();

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.WARNING,
                title: '⚠️ Avertissement Notifié',
                description: `**Membre :** ${target.user.tag}\n**Raison :** ${reason}\n**Total sanctions :** ${userWarns.length}`
            })]
        });
    }

    if (cmd === 'warnings') {
        const target = message.mentions.members.first() || message.member;
        const list = db.warnings.get(target.id) || [];

        if (list.length === 0) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🛡️ Casier Vierge', description: `${target.user.tag} n'a aucun avertissement.` })] });
        }

        const fields = list.map((w, i) => ({
            name: `Avertissement #${i + 1} (${w.date})`,
            value: `**Modérateur :** ${w.moderator}\n**Motif :** ${w.reason}`,
            inline: false
        }));

        return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: `📋 Casier de ${target.user.tag} (${list.length})`, fields })] });
    }

    if (cmd === 'note') {
        if (!isStaff(message.member)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const target = message.mentions.members.first();
        const noteText = args.slice(1).join(' ');
        if (!target || !noteText) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}note @membre <texte>\`` })] });

        const userNotes = db.notes.get(target.id) || [];
        userNotes.push({ text: noteText, moderator: message.author.tag, date: new Date().toLocaleString('fr-FR') });
        db.notes.set(target.id, userNotes);
        saveData();

        return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '📝 Note Enregistrée', description: `Note confidentielle ajoutée sur ${target.user.tag}.` })] });
    }

    if (cmd === 'notes') {
        if (!isStaff(message.member)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const target = message.mentions.members.first();
        if (!target) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}notes @membre\`` })] });

        const userNotes = db.notes.get(target.id) || [];
        if (!userNotes.length) return message.reply({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: '📝 Notes Internes', description: `Aucune note sur ${target.user.tag}.` })] });

        const fields = userNotes.map((n, i) => ({
            name: `Note #${i + 1} - ${n.moderator} (${n.date})`,
            value: n.text,
            inline: false
        }));

        return message.reply({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: `📁 Dossier Staff : ${target.user.tag}`, fields })] });
    }

    if (cmd === 'clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `MANAGE_MESSAGES` requise.' })] });
        }
        const count = parseInt(args[0], 10);
        if (isNaN(count) || count < 1 || count > 100) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}clear <1-100>\`` })] });
        }

        await message.delete().catch(() => {});
        const deleted = await message.channel.bulkDelete(count, true);
        const confirmation = await message.channel.send({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🧹 Purge Effectuée',
                description: `**${deleted.size}** message(s) supprimé(s) par ${message.author}.`
            })]
        });
        setTimeout(() => confirmation.delete().catch(() => {}), 4000);
        return;
    }

    // ─── SALONS & SÉCURITÉ ────────────────────────────────────────────────
    if (cmd === 'lock') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '🔒 Salon Verrouillé', description: `Écriture bloquée dans ${channel}.` })] });
    }

    if (cmd === 'unlock') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔓 Salon Déverrouillé', description: `Écriture rétablie dans ${channel}.` })] });
    }

    if (cmd === 'hide') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
        return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '👁️ Salon Masqué', description: `Visibilité désactivée pour ${channel}.` })] });
    }

    if (cmd === 'unhide') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const channel = message.mentions.channels.first() || message.channel;
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null });
        return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '👁️ Salon Visible', description: `Visibilité restaurée pour ${channel}.` })] });
    }

    if (cmd === 'renew' || cmd === 'nuke') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const channel = message.channel;
        const position = channel.position;
        const cloned = await channel.clone();
        await cloned.setPosition(position);
        await channel.delete();

        return cloned.send({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '⚡ Salon Recréé',
                description: `Salon nettoyé et recréé par ${message.author}.`
            })]
        });
    }

    if (cmd === 'slowmode') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const sec = parseInt(args[0], 10);
        if (isNaN(sec) || sec < 0 || sec > 21600) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}slowmode <0-21600>\`` })] });
        await message.channel.setRateLimitPerUser(sec);
        return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '⏱️ Mode Lent', description: sec === 0 ? 'Mode lent désactivé.' : `Temporisation fixée à **${sec}s**.` })] });
    }

    // ─── SÉCURITÉ ANTI-RAID & MODULES DÉFENSE ───────────────────────────────
    if (cmd === 'antiraid' || cmd === 'securite') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
            db.antiRaid.active = true;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🛡️ Sécurité Anti-Raid', description: 'Module anti-raid global **ACTIVÉ** (Défense maximale).' })] });
        } else if (sub === 'off') {
            db.antiRaid.active = false;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '🛡️ Sécurité Anti-Raid', description: 'Module anti-raid global mis en **PAUSE**.' })] });
        }
        // Affichage du Dashboard Interactif Complet
        const panel = buildAntiRaidConfigEmbed(message.guild);
        return message.reply({ embeds: [panel.embed], components: panel.components });
    }

    if (cmd === 'antispam') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiSpam = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiSpam = false;
        else db.antiRaid.antiSpam = !db.antiRaid.antiSpam;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiSpam ? COLORS.SUCCESS : COLORS.DANGER, title: '💬 Protection Anti-Spam', description: `L'anti-spam flood est désormais **${db.antiRaid.antiSpam ? 'ACTIVÉ' : 'DÉSACTIVÉ'}**.` })] });
    }

    if (cmd === 'antilink') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiLink = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiLink = false;
        else db.antiRaid.antiLink = !db.antiRaid.antiLink;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiLink ? COLORS.SUCCESS : COLORS.DANGER, title: '🔗 Protection Anti-Lien', description: `L'anti-liens d'invitation est désormais **${db.antiRaid.antiLink ? 'ACTIVÉ' : 'DÉSACTIVÉ'}**.` })] });
    }

    if (cmd === 'antibot') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiBot = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiBot = false;
        else db.antiRaid.antiBot = !db.antiRaid.antiBot;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiBot ? COLORS.SUCCESS : COLORS.DANGER, title: '🤖 Protection Anti-Bot', description: `L'expulsion automatique de bots non autorisés est désormais **${db.antiRaid.antiBot ? 'ACTIVÉE' : 'DÉSACTIVÉE'}**.` })] });
    }

    if (cmd === 'antimention' || cmd === 'massmention') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiMention = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiMention = false;
        else if (state && !isNaN(parseInt(state, 10))) {
            db.antiRaid.maxMentions = Math.max(1, parseInt(state, 10));
            db.antiRaid.antiMention = true;
        } else {
            db.antiRaid.antiMention = !db.antiRaid.antiMention;
        }

        if (args[1] && !isNaN(parseInt(args[1], 10))) {
            db.antiRaid.maxMentions = Math.max(1, parseInt(args[1], 10));
        }
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiMention ? COLORS.SUCCESS : COLORS.DANGER, title: '📢 Protection Anti-Mention', description: `La détection de mass-mention est **${db.antiRaid.antiMention ? 'ACTIVÉE' : 'DÉSACTIVÉE'}** (Seuil : **${db.antiRaid.maxMentions}** mentions max).` })] });
    }

    if (cmd === 'antichannel') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiChannel = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiChannel = false;
        else db.antiRaid.antiChannel = !db.antiRaid.antiChannel;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiChannel ? COLORS.SUCCESS : COLORS.DANGER, title: '📁 Protection Anti-Channel', description: `L'anti-suppression de salons est désormais **${db.antiRaid.antiChannel ? 'ACTIVÉ' : 'DÉSACTIVÉ'}**.` })] });
    }

    if (cmd === 'antirole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiRole = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiRole = false;
        else db.antiRaid.antiRole = !db.antiRaid.antiRole;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiRole ? COLORS.SUCCESS : COLORS.DANGER, title: '🎭 Protection Anti-Rôle', description: `L'anti-suppression de rôles est désormais **${db.antiRaid.antiRole ? 'ACTIVÉ' : 'DÉSACTIVÉ'}**.` })] });
    }

    if (cmd === 'antiban' || cmd === 'antimassban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.antiRaid.antiBan = true;
        else if (state === 'off' || state === 'disable') db.antiRaid.antiBan = false;
        else db.antiRaid.antiBan = !db.antiRaid.antiBan;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: db.antiRaid.antiBan ? COLORS.SUCCESS : COLORS.DANGER, title: '🔨 Protection Anti-MassBan', description: `La surveillance des expulsions et bans massifs est désormais **${db.antiRaid.antiBan ? 'ACTIVÉE' : 'DÉSACTIVÉE'}**.` })] });
    }

    // ─── CONFIGURATION DES PERMISSIONS (+set addrole / delrole / derank) ──
    if ((cmd === 'set' && args[0]?.toLowerCase() === 'addrole') || cmd === 'setaddrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const panel = buildAddRoleConfigEmbed(message.guild);
        return message.reply({ embeds: [panel.embed], components: panel.components });
    }

    if ((cmd === 'set' && args[0]?.toLowerCase() === 'delrole') || cmd === 'setdelrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const panel = buildDelRoleConfigEmbed(message.guild);
        return message.reply({ embeds: [panel.embed], components: panel.components });
    }

    if ((cmd === 'set' && args[0]?.toLowerCase() === 'derank') || cmd === 'setderank') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission `ADMINISTRATOR` requise.' })] });
        }
        const panel = buildDerankConfigEmbed(message.guild);
        return message.reply({ embeds: [panel.embed], components: panel.components });
    }

    // ─── GESTION DES RÔLES : +addrole (id role) (id mec) ──────────────────
    if (cmd === 'addrole') {
        const canAdd = message.member.permissions.has(PermissionsBitField.Flags.Administrator)
            || message.author.id === message.guild.ownerId
            || (db.rolePerms.addRole && message.member.roles.cache.has(db.rolePerms.addRole));

        if (!canAdd) {
            const roleReq = db.rolePerms.addRole ? `<@&${db.rolePerms.addRole}>` : '`ADMINISTRATOR`';
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: `Vous devez posséder la permission Administrateur ou le rôle ${roleReq} pour exécuter \`${PREFIX}addrole\`.` })] });
        }

        const { role, member: target } = await resolveMemberAndRole(message.guild, args[0], args[1]);
        if (!role || !target) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}addrole <id_rôle | @rôle> <id_membre | @membre>\`\n` +
                                 `Exemple : \`${PREFIX}addrole 123456789012345678 987654321098765432\``
                })]
            });
        }

        const botHighest = message.guild.members.me.roles.highest.position;
        if (role.position >= botHighest) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Le bot ne peut pas attribuer le rôle **@${role.name}** car ce dernier est égal ou supérieur à son propre rôle le plus haut.` })] });
        }

        if (message.author.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Vous ne pouvez pas attribuer un rôle supérieur ou égal au vôtre (**@${role.name}**).` })] });
        }

        if (target.roles.cache.has(role.id)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: 'ℹ️ Rôle déjà attribué', description: `${target} possède déjà le rôle **@${role.name}** (\`${role.id}\`).` })] });
        }

        const userBl = db.blacklistedRoles[target.id] || [];
        if (userBl.includes(role.id)) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.DANGER,
                    title: '⛔ Rôle Blacklisté',
                    description: `Le rôle **@${role.name}** est **strictement blacklisté** pour ${target} via la commande \`${PREFIX}blrank\`.\nUtilisez \`${PREFIX}unblrank\` pour lever la restriction.`
                })]
            });
        }

        await target.roles.add(role, `Attribué par ${message.author.tag} (+addrole)`);
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🎭 Rôle Attribué',
                description: `Le rôle **@${role.name}** a été accordé avec succès à ${target}.`,
                fields: [
                    { name: '👤 Membre', value: `${target} (\`${target.id}\`)`, inline: true },
                    { name: '🎭 Rôle Ajouté', value: `**@${role.name}** (\`${role.id}\`)`, inline: true },
                    { name: '🛡️ Modérateur', value: `${message.author}`, inline: true }
                ]
            })]
        });
    }

    // ─── GESTION DES RÔLES : +delrole (id role) (id mec) ──────────────────
    if (cmd === 'delrole') {
        const canDel = message.member.permissions.has(PermissionsBitField.Flags.Administrator)
            || message.author.id === message.guild.ownerId
            || (db.rolePerms.delRole && message.member.roles.cache.has(db.rolePerms.delRole));

        if (!canDel) {
            const roleReq = db.rolePerms.delRole ? `<@&${db.rolePerms.delRole}>` : '`ADMINISTRATOR`';
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: `Vous devez posséder la permission Administrateur ou le rôle ${roleReq} pour exécuter \`${PREFIX}delrole\`.` })] });
        }

        const { role, member: target } = await resolveMemberAndRole(message.guild, args[0], args[1]);
        if (!role || !target) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}delrole <id_rôle | @rôle> <id_membre | @membre>\`\n` +
                                 `Exemple : \`${PREFIX}delrole 123456789012345678 987654321098765432\``
                })]
            });
        }

        const botHighest = message.guild.members.me.roles.highest.position;
        if (role.position >= botHighest) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Le bot ne peut pas retirer le rôle **@${role.name}** car ce dernier est égal ou supérieur à son propre rôle le plus haut.` })] });
        }

        if (message.author.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Vous ne pouvez pas retirer un rôle supérieur ou égal au vôtre (**@${role.name}**).` })] });
        }

        if (!target.roles.cache.has(role.id)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: 'ℹ️ Rôle absent', description: `${target} ne possède pas le rôle **@${role.name}** (\`${role.id}\`).` })] });
        }

        await target.roles.remove(role, `Retiré par ${message.author.tag} (+delrole)`);
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🎭 Rôle Retiré',
                description: `Le rôle **@${role.name}** a été retiré de ${target}.`,
                fields: [
                    { name: '👤 Membre', value: `${target} (\`${target.id}\`)`, inline: true },
                    { name: '🎭 Rôle Retiré', value: `**@${role.name}** (\`${role.id}\`)`, inline: true },
                    { name: '🛡️ Modérateur', value: `${message.author}`, inline: true }
                ]
            })]
        });
    }

    // ─── GESTION DES RÔLES : +derank @membre ──────────────────────────────
    if (cmd === 'derank') {
        const canDerank = message.member.permissions.has(PermissionsBitField.Flags.Administrator)
            || message.author.id === message.guild.ownerId
            || (db.rolePerms.derankAllowed && message.member.roles.cache.has(db.rolePerms.derankAllowed));

        if (!canDerank) {
            const roleReq = db.rolePerms.derankAllowed ? `<@&${db.rolePerms.derankAllowed}>` : '`ADMINISTRATOR`';
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: `Vous devez posséder la permission Administrateur ou le rôle ${roleReq} pour exécuter \`${PREFIX}derank\`.` })] });
        }

        const rawTarget = args[0]?.replace(/[<@!>]/g, '');
        const target = message.mentions.members.first() || (rawTarget ? await message.guild.members.fetch(rawTarget).catch(() => null) : null);

        if (!target) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe de la commande', description: `Usage : \`${PREFIX}derank <@membre | id_membre>\`\nExemple : \`${PREFIX}derank @Utilisateur\`` })] });
        }

        if (target.id === message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Action impossible', description: 'Le propriétaire du serveur ne peut pas être derank.' })] });
        }

        if (message.author.id !== message.guild.ownerId && target.roles.highest.position >= message.member.roles.highest.position) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Vous ne pouvez pas derank un membre ayant un rôle supérieur ou égal au vôtre (${target}).` })] });
        }

        const botHighest = message.guild.members.me.roles.highest.position;
        const protectedRoleId = db.rolePerms.derankProtected;

        const rolesToRemove = target.roles.cache.filter(r => {
            if (r.id === message.guild.id) return false; // @everyone
            if (r.managed) return false; // Bot integrations, boosts
            if (protectedRoleId && r.id === protectedRoleId) return false; // Rôle protégé conservé !
            if (r.position >= botHighest) return false; // Supérieur au bot
            return true;
        });

        if (rolesToRemove.size === 0) {
            const extra = protectedRoleId ? ` (ou ne possède que le rôle protégé \`${protectedRoleId}\`)` : '';
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: 'ℹ️ Aucun rôle à révoquer', description: `${target} ne possède aucun rôle retirable${extra}.` })] });
        }

        await target.roles.remove(rolesToRemove, `Derank exécuté par ${message.author.tag}`);

        const protectedRoleObj = protectedRoleId ? message.guild.roles.cache.get(protectedRoleId) : null;
        const protectedDisplay = protectedRoleId
            ? `🟢 **Rôle protégé conservé :** **@${protectedRoleObj ? protectedRoleObj.name : protectedRoleId}** (\`${protectedRoleId}\`)`
            : `⚠️ **Aucun rôle protégé configuré :** Tous les rôles ont été retirés.`;

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.DANGER,
                title: '⚡ Derank Effectué avec Succès',
                description: `Les privilèges de ${target} ont été révoqués par ${message.author}.\n\n${protectedDisplay}`,
                fields: [
                    { name: '👤 Membre Ciblé', value: `${target} (\`${target.id}\`)`, inline: true },
                    { name: '🗑️ Rôles Retirés', value: `**${rolesToRemove.size}** rôle(s)`, inline: true },
                    { name: '🛡️ Exécuteur', value: `${message.author}`, inline: true }
                ]
            })]
        });
    }

    // ─── GESTION DES RÔLES : +blrank (id role) (id mec) ──────────────────
    if (cmd === 'blrank' || cmd === 'roleblacklist' || cmd === 'blacklistrank') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
            !message.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
            message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise pour blacklister un rôle.' })] });
        }

        // Sous-commande d'affichage : +blrank list [cible]
        if (args[0]?.toLowerCase() === 'list') {
            const raw = args[1]?.replace(/[<@!>]/g, '');
            const targetMember = message.mentions.members.first() || (raw ? await message.guild.members.fetch(raw).catch(() => null) : null);
            if (targetMember) {
                const list = db.blacklistedRoles[targetMember.id] || [];
                const roleListStr = list.length > 0
                    ? list.map(id => `• <@&${id}> (\`${id}\`)`).join('\n')
                    : '*Aucun rôle blacklisté pour ce membre.*';

                return message.reply({
                    embeds: [makeEmbed({
                        color: COLORS.PRIMARY,
                        title: `🚫 Rôles Blacklistés : ${targetMember.user.tag}`,
                        description: `Ce membre a l'interdiction stricte de porter ces rôles :\n\n${roleListStr}`
                    })]
                });
            }

            const entries = Object.entries(db.blacklistedRoles).filter(([_, roles]) => roles && roles.length > 0);
            if (entries.length === 0) {
                return message.reply({
                    embeds: [makeEmbed({
                        color: COLORS.PRIMARY,
                        title: '🚫 Rôles Blacklistés sur le Serveur',
                        description: '*Aucun rôle n\'est actuellement blacklisté sur le serveur.*'
                    })]
                });
            }

            const desc = entries.slice(0, 15).map(([userId, roles]) => {
                const rolesStr = roles.map(rId => `<@&${rId}>`).join(' ');
                return `• <@${userId}> (\`${userId}\`) : ${rolesStr}`;
            }).join('\n');

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.PRIMARY,
                    title: `🚫 Rôles Blacklistés (${entries.length} membre(s) restreint(s))`,
                    description: desc
                })]
            });
        }

        const { role, member: target } = await resolveMemberAndRole(message.guild, args[0], args[1]);
        if (!role || !target) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}blrank <id_rôle | @rôle> <id_membre | @membre>\`\n` +
                                 `Exemple : \`${PREFIX}blrank 123456789012345678 987654321098765432\`\n\n` +
                                 `💡 Pour consulter la liste : \`${PREFIX}blrank list\` ou \`${PREFIX}blrank list @membre\``
                })]
            });
        }

        const botHighest = message.guild.members.me.roles.highest.position;
        if (role.position >= botHighest) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Le bot ne peut pas gérer le rôle ${role} car il est égal ou supérieur à son propre rôle le plus haut.` })] });
        }

        if (message.author.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Hiérarchie insuffisante', description: `Vous ne pouvez pas blacklister un rôle supérieur ou égal au vôtre (${role}).` })] });
        }

        if (!db.blacklistedRoles[target.id]) {
            db.blacklistedRoles[target.id] = [];
        }

        if (db.blacklistedRoles[target.id].includes(role.id)) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: 'ℹ️ Déjà Blacklisté',
                    description: `Le rôle ${role} est déjà dans la liste noire de ${target}.`
                })]
            });
        }

        // Enregistrement persistant
        db.blacklistedRoles[target.id].push(role.id);
        saveData();

        // Révocation immédiate si le membre détient le rôle
        let roleRemoved = false;
        if (target.roles.cache.has(role.id)) {
            await target.roles.remove(role, `BLRank par ${message.author.tag}`).catch(() => {});
            roleRemoved = true;
        }

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.DANGER,
                title: '🚫 Rôle Blacklisté avec Succès',
                description: `Le rôle ${role} a été **strictement interdit** pour ${target}.\nLe système lui retirera automatiquement ce rôle s'il lui est réattribué.`,
                fields: [
                    { name: '👤 Membre Cible', value: `${target} (\`${target.id}\`)`, inline: true },
                    { name: '🎭 Rôle Interdit', value: `${role} (\`${role.id}\`)`, inline: true },
                    { name: '⚡ Action Immédiate', value: roleRemoved ? '🔴 **Rôle révoqué instantanément**' : '🔒 **Verrouillage actif**', inline: true },
                    { name: '🛡️ Modérateur', value: `${message.author}`, inline: true }
                ]
            })]
        });
    }

    // ─── GESTION DES RÔLES : +unblrank (id role) (id mec) ────────────────
    if (cmd === 'unblrank' || cmd === 'unblacklistrank') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
            !message.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
            message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise pour dé-blacklister un rôle.' })] });
        }

        const { role, member: target } = await resolveMemberAndRole(message.guild, args[0], args[1]);
        if (!role || !target) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}unblrank <id_rôle | @rôle> <id_membre | @membre>\`\n` +
                                 `Exemple : \`${PREFIX}unblrank 123456789012345678 987654321098765432\``
                })]
            });
        }

        const userBl = db.blacklistedRoles[target.id] || [];
        if (!userBl.includes(role.id)) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: 'ℹ️ Non Blacklisté',
                    description: `Le rôle ${role} n'est pas blacklisté pour ${target}.`
                })]
            });
        }

        db.blacklistedRoles[target.id] = userBl.filter(id => id !== role.id);
        if (db.blacklistedRoles[target.id].length === 0) {
            delete db.blacklistedRoles[target.id];
        }
        saveData();

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '✅ Rôle Retiré de la Blacklist',
                description: `Le rôle ${role} n'est plus blacklisté pour ${target}.\nCe rôle peut de nouveau lui être accordé.`,
                fields: [
                    { name: '👤 Membre Cible', value: `${target} (\`${target.id}\`)`, inline: true },
                    { name: '🎭 Rôle Débloqué', value: `${role} (\`${role.id}\`)`, inline: true },
                    { name: '🛡️ Modérateur', value: `${message.author}`, inline: true }
                ]
            })]
        });
    }

    if (cmd === 'nick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const target = message.mentions.members.first();
        const newNick = args.slice(1).join(' ');
        if (!target) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}nick @membre [nouveau_pseudo]\`` })] });
        await target.setNickname(newNick || null);
        return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '✏️ Surnom Modifié', description: `Surnom de ${target.user.tag} mis à jour.` })] });
    }

    if (cmd === 'roleinfo') {
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}roleinfo @rôle\`` })] });
        return message.reply({
            embeds: [makeEmbed({
                color: role.color || COLORS.PRIMARY,
                title: `🎭 Rôle : ${role.name}`,
                fields: [
                    { name: '🆔 ID', value: `\`${role.id}\``, inline: true },
                    { name: '🎨 HEX', value: `\`#${role.color.toString(16).padStart(6, '0')}\``, inline: true },
                    { name: '👥 Membres', value: `${role.members.size}`, inline: true },
                    { name: '🔒 Admin', value: role.permissions.has(PermissionsBitField.Flags.Administrator) ? 'Oui' : 'Non', inline: true }
                ]
            })]
        });
    }

    // ─── INFORMATIONS & STATS ─────────────────────────────────────────────
    if (cmd === 'serverinfo') {
        const { guild } = message;
        const owner = await guild.fetchOwner();
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.PRIMARY,
                title: `📊 ${guild.name}`,
                thumbnail: guild.iconURL({ dynamic: true }),
                fields: [
                    { name: '👑 Propriétaire', value: `${owner.user.tag}`, inline: true },
                    { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                    { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
                    { name: '📁 Salons', value: `${guild.channels.cache.size}`, inline: true },
                    { name: '🎭 Rôles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: '📅 Date de création', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                ]
            })]
        });
    }

    if (cmd === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const user = member.user;
        return message.reply({
            embeds: [makeEmbed({
                color: member.displayColor || COLORS.PRIMARY,
                title: `👤 Profil : ${user.tag}`,
                thumbnail: user.displayAvatarURL({ dynamic: true }),
                fields: [
                    { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
                    { name: '🤖 Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
                    { name: '🎨 Rôle max', value: `${member.roles.highest}`, inline: true },
                    { name: '📅 Inscription', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:f>`, inline: false },
                    { name: '📥 Arrivée serveur', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>`, inline: false }
                ]
            })]
        });
    }

    if (cmd === 'avatar') {
        const target = message.mentions.users.first() || message.author;
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle(`🖼️ Avatar : ${target.tag}`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 2048 }))
                .setFooter({ text: 'Supreme Management' })]
        });
    }

    if (cmd === 'banner') {
        const target = message.mentions.users.first() || message.author;
        const fetched = await client.users.fetch(target.id, { force: true });
        const bannerUrl = fetched.bannerURL({ dynamic: true, size: 2048 });
        if (!bannerUrl) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '🖼️ Bannière', description: `${target.tag} n'a pas de bannière.` })] });
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle(`🖼️ Bannière : ${target.tag}`)
                .setImage(bannerUrl)
                .setFooter({ text: 'Supreme Management' })]
        });
    }

    if (cmd === 'ping') {
        const pingMsg = await message.reply('🏓 Calcul de la latence...');
        const latency = pingMsg.createdTimestamp - message.createdTimestamp;
        return pingMsg.edit({
            content: null,
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🏓 Latence Système',
                fields: [
                    { name: 'Message', value: `\`${latency} ms\``, inline: true },
                    { name: 'API WebSocket', value: `\`${Math.round(client.ws.ping)} ms\``, inline: true }
                ]
            })]
        });
    }

    if (cmd === 'botinfo') {
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const uptimeHours = Math.floor(process.uptime() / 3600);
        const uptimeMin = Math.floor((process.uptime() % 3600) / 60);
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.PRIMARY,
                title: '🤖 Architecture du Bot',
                fields: [
                    { name: '⚙️ Environnement', value: `Node.js ${process.version}`, inline: true },
                    { name: '🧠 RAM', value: `\`${memoryUsage} MB\``, inline: true },
                    { name: '⏱️ Uptime', value: `${uptimeHours}h ${uptimeMin}m`, inline: true },
                    { name: '🌐 Serveurs', value: `${client.guilds.cache.size}`, inline: true }
                ]
            })]
        });
    }

    if (cmd === 'poll') {
        const question = args.join(' ');
        if (!question) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}poll <question>\`` })] });
        await message.delete().catch(() => {});
        const pollMsg = await message.channel.send({
            embeds: [makeEmbed({ color: COLORS.CYAN, title: '📊 Sondage Communautaire', description: `${question}\n\n*Lancé par ${message.author}*` })]
        });
        await pollMsg.react('✅');
        await pollMsg.react('❌');
        return;
    }

    if (cmd === 'say') {
        if (!isStaff(message.member)) return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Accès refusé', description: 'Permission requise.' })] });
        const text = args.join(' ');
        if (!text) return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}say <texte>\`` })] });
        await message.delete().catch(() => {});
        return message.channel.send({
            embeds: [makeEmbed({ color: COLORS.DEFAULT, title: '📢 Communication Officielle', description: text })]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODULE HIÉRARCHIE & PERMISSIONS (+owner, +unowner, +owners, +buyer, +manager)
    // ═══════════════════════════════════════════════════════════════════════

    // ─── +owner <@membre/id> ──────────────────────────────────────────────
    if (cmd === 'owner') {
        if (!isBuyer(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul le propriétaire principal du serveur ou un Buyer peut nommer un co-propriétaire.');
        }
        const target = message.mentions.members.first() || (args[0] ? await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null);
        if (!target) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}owner <@membre | ID>\`` })] });
        }
        if (!db.owners.includes(target.id)) {
            db.owners.push(target.id);
            saveData();
        }
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '👑 Co-Propriétaire Ajouté',
                description: `${target} (\`${target.id}\`) a été ajouté à la liste des co-propriétaires avec succès.`
            })]
        });
    }

    // ─── +unowner <@membre/id> ────────────────────────────────────────────
    if (cmd === 'unowner') {
        if (!isBuyer(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul le propriétaire principal du serveur ou un Buyer peut révoquer un co-propriétaire.');
        }
        const targetId = message.mentions.members.first()?.id || args[0]?.replace(/[<@!>]/g, '');
        if (!targetId || !db.owners.includes(targetId)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Introuvable', description: 'Ce membre ne figure pas parmi les co-propriétaires.' })] });
        }
        db.owners = db.owners.filter(id => id !== targetId);
        saveData();
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '👑 Co-Propriétaire Retiré',
                description: `<@${targetId}> (\`${targetId}\`) a été retiré des co-propriétaires.`
            })]
        });
    }

    // ─── +owners ──────────────────────────────────────────────────────────
    if (cmd === 'owners') {
        const guildOwner = `<@${message.guild.ownerId}> (\`${message.guild.ownerId}\`) - *Fondateur Serveur*`;
        const coOwners = db.owners.length > 0
            ? db.owners.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
            : '*Aucun co-propriétaire additionnel enregistré.*';

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.PRIMARY,
                title: '👑 Liste des Propriétaires du Serveur',
                fields: [
                    { name: 'Propriétaire Suprême', value: guildOwner, inline: false },
                    { name: `Co-Propriétaires (${db.owners.length})`, value: coOwners, inline: false }
                ]
            })]
        });
    }

    // ─── +buyer / +addbuy <@membre/id> ────────────────────────────────────
    if (cmd === 'buyer' || cmd === 'addbuy') {
        if (!isBuyer(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul un Buyer ou le propriétaire suprême peut attribuer le rang Buyer.');
        }
        const target = message.mentions.members.first() || (args[0] ? await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null);
        if (!target) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}buyer <@membre | ID>\`` })] });
        }
        if (!db.buyers.includes(target.id)) {
            db.buyers.push(target.id);
            saveData();
        }
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.PURPLE,
                title: '💎 Nouveau Statut Buyer Attribué',
                description: `${target} (\`${target.id}\`) bénéficie désormais d'un accès global Buyer sur le bot.`
            })]
        });
    }

    // ─── +unbuyer / +delbuy <@membre/id> ──────────────────────────────────
    if (cmd === 'unbuyer' || cmd === 'delbuy') {
        if (!isBuyer(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul un Buyer ou le propriétaire suprême peut retirer le rang Buyer.');
        }
        const targetId = message.mentions.members.first()?.id || args[0]?.replace(/[<@!>]/g, '');
        if (!targetId || !db.buyers.includes(targetId)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Introuvable', description: 'Ce membre ne figure pas parmi les buyers enregistrés.' })] });
        }
        db.buyers = db.buyers.filter(id => id !== targetId);
        saveData();
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '💎 Statut Buyer Révoqué',
                description: `<@${targetId}> (\`${targetId}\`) a été retiré de la liste des buyers.`
            })]
        });
    }

    // ─── +addmanager <@membre/id> ─────────────────────────────────────────
    if (cmd === 'addmanager') {
        if (!isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul un Propriétaire ou un Buyer peut désigner un gestionnaire.');
        }
        const target = message.mentions.members.first() || (args[0] ? await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null);
        if (!target) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}addmanager <@membre | ID>\`` })] });
        }
        if (!db.managers.includes(target.id)) {
            db.managers.push(target.id);
            saveData();
        }
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🛡️ Gestionnaire Ajouté',
                description: `${target} (\`${target.id}\`) a été nommé gestionnaire du bot.`
            })]
        });
    }

    // ─── +delmanager <@membre/id> ─────────────────────────────────────────
    if (cmd === 'delmanager') {
        if (!isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul un Propriétaire ou un Buyer peut retirer un gestionnaire.');
        }
        const targetId = message.mentions.members.first()?.id || args[0]?.replace(/[<@!>]/g, '');
        if (!targetId || !db.managers.includes(targetId)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Introuvable', description: 'Ce membre n\'est pas enregistré comme gestionnaire.' })] });
        }
        db.managers = db.managers.filter(id => id !== targetId);
        saveData();
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🛡️ Gestionnaire Retiré',
                description: `<@${targetId}> (\`${targetId}\`) n'est plus gestionnaire.`
            })]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODULE BLACKLIST GLOBALE (+bl, +unbl)
    // ═══════════════════════════════════════════════════════════════════════

    // ─── +bl <@membre/id> [raison] ────────────────────────────────────────
    if (cmd === 'bl' || cmd === 'blacklist') {
        if (!isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire ou Administrateur requise pour utiliser la blacklist.');
        }
        const targetId = message.mentions.members.first()?.id || args[0]?.replace(/[<@!>]/g, '');
        if (!targetId) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}bl <@membre | ID> [raison]\`` })] });
        }
        if (targetId === message.author.id || targetId === message.guild.ownerId || db.owners.includes(targetId) || db.buyers.includes(targetId)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Action Impossible', description: 'Vous ne pouvez pas blacklister un propriétaire ou vous-même.' })] });
        }

        const reason = args.slice(1).join(' ') || 'Blacklist globale bot';
        if (!db.blacklist.includes(targetId)) {
            db.blacklist.push(targetId);
            saveData();
        }

        // Bannissement immédiat du serveur s'il est présent
        const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
        if (targetMember && targetMember.bannable) {
            await targetMember.ban({ reason: `[Blacklist Supreme] ${reason} - Par ${message.author.tag}` }).catch(() => {});
        } else {
            await message.guild.bans.create(targetId, { reason: `[Blacklist Supreme] ${reason}` }).catch(() => {});
        }

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.DANGER,
                title: '🚫 Membre Placé sur la Blacklist',
                description: `L'utilisateur <@${targetId}> (\`${targetId}\`) a été banni et inscrit sur la liste noire globale du bot.\n**Raison :** ${reason}`
            })]
        });
    }

    // ─── +unbl <id> ───────────────────────────────────────────────────────
    if (cmd === 'unbl' || cmd === 'unblacklist') {
        if (!isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire ou Administrateur requise pour lever une blacklist.');
        }
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        if (!targetId || !db.blacklist.includes(targetId)) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Introuvable', description: 'Cet utilisateur ne figure pas dans la blacklist.' })] });
        }
        db.blacklist = db.blacklist.filter(id => id !== targetId);
        saveData();

        await message.guild.bans.remove(targetId, 'Blacklist levée par commande +unbl').catch(() => {});

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '✅ Membre Retiré de la Blacklist',
                description: `L'utilisateur <@${targetId}> (\`${targetId}\`) a été retiré de la liste noire et débanni du serveur.`
            })]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODULE CONFIGURATION & UTILITAIRES (+listoff, +mainprefix, +prefix, +change, +hidereply, +theme)
    // ═══════════════════════════════════════════════════════════════════════

    // ─── +listoff ─────────────────────────────────────────────────────────
    if (cmd === 'listoff') {
        const sub = args[0]?.toLowerCase();
        if (sub && isOwner(message.author.id, message.guild)) {
            // Bascule / toggle d'une commande
            if (db.disabledCommands.includes(sub)) {
                db.disabledCommands = db.disabledCommands.filter(c => c !== sub);
                saveData();
                return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '✅ Commande Réactivée', description: `La commande \`${sub}\` est désormais réactivée.` })] });
            } else {
                db.disabledCommands.push(sub);
                saveData();
                return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Commande Désactivée', description: `La commande \`${sub}\` a été désactivée.` })] });
            }
        }

        const list = db.disabledCommands.length > 0
            ? db.disabledCommands.map(c => `• \`${PREFIX}${c}\``).join('\n')
            : '*Aucune commande désactivée sur ce serveur.*';

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.PRIMARY,
                title: '🚫 Commandes Désactivées',
                description: list,
                footer: isOwner(message.author.id, message.guild) ? `Astuce : ${PREFIX}listoff <commande> pour basculer son statut` : 'Supreme Management'
            })]
        });
    }

    // ─── +mainprefix & +prefix ────────────────────────────────────────────
    if (cmd === 'mainprefix' || cmd === 'prefix') {
        if (!isManager(message.member) && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire ou Propriétaire requise pour modifier le préfixe.');
        }
        const newPrefix = args[0]?.trim();
        if (!newPrefix) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}${cmd} <nouveau_prefix>\`\nExemple : \`${PREFIX}${cmd} !\`` })] });
        }
        if (newPrefix.length > 5) {
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '⛔ Erreur', description: 'Le préfixe ne peut pas dépasser 5 caractères.' })] });
        }
        db.prefix = newPrefix;
        saveData();
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '⚙️ Préfixe Mis à Jour',
                description: `Le préfixe du bot est désormais configuré sur : \`${newPrefix}\``
            })]
        });
    }

    // ─── +change <cmd> <role/permission/none> ──────────────────────────────
    if (cmd === 'change') {
        if (!isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Seul un Propriétaire du serveur peut réassigner les permissions d\'une commande.');
        }
        const targetCmd = args[0]?.toLowerCase().replace(PREFIX, '');
        const targetRoleOrPerm = args[1]?.replace(/[<@&>]/g, '');

        if (!targetCmd || !targetRoleOrPerm) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}change <commande> <@role | ID | Permission | none>\`\nExemple : \`${PREFIX}change ban 123456789012345678\` ou \`${PREFIX}change ban clear\``
                })]
            });
        }

        if (targetRoleOrPerm === 'none' || targetRoleOrPerm === 'clear' || targetRoleOrPerm === 'reset') {
            delete db.commandPerms[targetCmd];
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔄 Permission Réinitialisée', description: `La commande \`${targetCmd}\` utilise désormais ses permissions natives par défaut.` })] });
        }

        db.commandPerms[targetCmd] = targetRoleOrPerm;
        saveData();
        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '🔒 Permission de Commande Modifiée',
                description: `La commande \`${targetCmd}\` requiert désormais le rôle ou la permission : \`${targetRoleOrPerm}\``
            })]
        });
    }

    // ─── +hidereply [on/off] ──────────────────────────────────────────────
    if (cmd === 'hidereply') {
        if (!isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire requise.');
        }
        const state = args[0]?.toLowerCase();
        if (state === 'on' || state === 'enable') db.hideReply = true;
        else if (state === 'off' || state === 'disable') db.hideReply = false;
        else db.hideReply = !db.hideReply;
        saveData();

        return message.reply({
            embeds: [makeEmbed({
                color: db.hideReply ? COLORS.SUCCESS : COLORS.WARNING,
                title: '👁️ Mode HideReply',
                description: `Les messages de refus de permissions sont désormais **${db.hideReply ? 'INVISIBLES (Muets)' : 'VISIBLES (Embeds de refus)'}**.`
            })]
        });
    }

    // ─── +theme <#hex / nom_couleur> ──────────────────────────────────────
    if (cmd === 'theme') {
        if (!isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire requise pour modifier le thème.');
        }
        const colorInput = args[0]?.toLowerCase();
        if (!colorInput) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.PRIMARY,
                    title: '🎨 Thème Graphique du Bot',
                    description: `Thème actuel : \`${db.theme || 'Défaut (#1e1f22)'}\`\n\nUsage : \`${PREFIX}theme <#hex | nom>\`\nPresets disponibles : \`purple\`, \`blue\`, \`red\`, \`green\`, \`yellow\`, \`cyan\`, \`default\``
                })]
            });
        }

        const presets = {
            purple: '#c084fc',
            blue: '#5865f2',
            red: '#ed4245',
            green: '#57f287',
            yellow: '#fee75c',
            cyan: '#00bcd4',
            dark: '#1e1f22',
            default: '#1e1f22'
        };

        const targetColor = presets[colorInput] || (colorInput.startsWith('#') ? colorInput : `#${colorInput}`);
        db.theme = targetColor;
        saveData();

        return message.reply({
            embeds: [makeEmbed({
                color: parseInt(targetColor.replace('#', ''), 16),
                title: '🎨 Thème Graphique Appliqué',
                description: `La couleur dominante des embeds du bot a été définie sur **${targetColor}**.`
            })]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODULE LOGS & TRAÇABILITÉ (+autologs, +setlog, +modlogs, +msglogs, etc.)
    // ═══════════════════════════════════════════════════════════════════════

    // ─── +autologs ────────────────────────────────────────────────────────
    if (cmd === 'autologs') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Permission Administrateur requise pour déployer l\'AutoLogs.');
        }

        const progressMsg = await message.reply('⏳ Création de la catégorie et des salons de logs sécurisés...');

        try {
            // Création de la catégorie privée
            const category = await message.guild.channels.create({
                name: '📁・LOGS SUPREME',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: message.guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks]
                    }
                ]
            });

            const logChannelsToCreate = [
                { key: 'mod', name: '🔨・logs-mod' },
                { key: 'msg', name: '💬・logs-messages' },
                { key: 'raid', name: '🚨・logs-antiraid' },
                { key: 'role', name: '🎭・logs-roles' },
                { key: 'voice', name: '🔊・logs-vocaux' },
                { key: 'boost', name: '🚀・logs-boosts' },
                { key: 'captcha', name: '🤖・logs-captcha' }
            ];

            const createdLogs = {};
            for (const item of logChannelsToCreate) {
                const createdChan = await message.guild.channels.create({
                    name: item.name,
                    type: ChannelType.GuildText,
                    parent: category.id
                });
                createdLogs[item.key] = createdChan.id;
            }

            db.logs = { ...db.logs, ...createdLogs };
            saveData();

            await progressMsg.delete().catch(() => {});

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '📁 Système AutoLogs Déployé avec Succès',
                    description: `Catégorie et salons de logs créés et protégés.\n\n` +
                        `• **Sanctions (bans/kicks/mutes) :** <#${createdLogs.mod}>\n` +
                        `• **Messages supprimés & édités :** <#${createdLogs.msg}>\n` +
                        `• **Alertes Anti-Raid :** <#${createdLogs.raid}>\n` +
                        `• **Rôles membres & créations :** <#${createdLogs.role}>\n` +
                        `• **Activité Vocale :** <#${createdLogs.voice}>\n` +
                        `• **Boosts Serveur :** <#${createdLogs.boost}>\n` +
                        `• **Vérifications Captcha :** <#${createdLogs.captcha}>`
                })]
            });
        } catch (err) {
            console.error('[AUTOLOGS] Erreur création salons de logs:', err);
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '❌ Erreur', description: 'Impossible de créer les salons de logs (vérifiez mes permissions "Gérer les salons").' })] });
        }
    }

    // ─── +setlog / +setlogs <type> <#salon> ────────────────────────────────
    if (cmd === 'setlog' || cmd === 'setlogs') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Administrateur ou Gestionnaire requise.');
        }
        const type = args[0]?.toLowerCase();
        const targetChannel = message.mentions.channels.first() || (args[1] ? message.guild.channels.cache.get(args[1].replace(/[<#>]/g, '')) : message.channel);

        const validTypes = ['mod', 'msg', 'raid', 'role', 'voice', 'boost', 'captcha'];
        if (!type || (!validTypes.includes(type) && type !== 'all')) {
            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.WARNING,
                    title: '⚠️ Syntaxe de la commande',
                    description: `Usage : \`${PREFIX}${cmd} <type> [#salon]\`\nTypes valides : \`mod\`, \`msg\`, \`raid\`, \`role\`, \`voice\`, \`boost\`, \`captcha\`, \`all\`\nExemple : \`${PREFIX}setlog mod #logs-sanctions\``
                })]
            });
        }

        if (type === 'all') {
            for (const k of validTypes) db.logs[k] = targetChannel.id;
        } else {
            db.logs[type] = targetChannel.id;
        }
        saveData();

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '📁 Configuration de Salon de Log Enregistrée',
                description: `Le type de log **${type}** a été assigné au salon ${targetChannel}.`
            })]
        });
    }

    // Helper de bascule rapide pour les commandes de logs individuelles
    const handleIndividualLogToggle = async (logKey, logName) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission requise.');
        }
        const firstArg = args[0]?.toLowerCase();
        if (firstArg === 'off' || firstArg === 'disable') {
            db.logs[logKey] = null;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: `📁 Logs ${logName} Désactivés`, description: `Le traçage de ${logName.toLowerCase()} est désactivé.` })] });
        }
        const targetChan = message.mentions.channels.first() || (firstArg ? message.guild.channels.cache.get(firstArg.replace(/[<#>]/g, '')) : message.channel);
        db.logs[logKey] = targetChan.id;
        saveData();
        return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: `📁 Logs ${logName} Activés`, description: `Les logs ${logName.toLowerCase()} sont redirigés vers ${targetChan}.` })] });
    };

    if (cmd === 'modlogs') return handleIndividualLogToggle('mod', 'Sanctions (Bans/Kicks/Mutes)');
    if (cmd === 'msglogs') return handleIndividualLogToggle('msg', 'Messages Supprimés / Édités');
    if (cmd === 'raidlogs') return handleIndividualLogToggle('raid', 'Alertes Anti-Raid');
    if (cmd === 'rolelogs') return handleIndividualLogToggle('role', 'Rôles & Permissions');
    if (cmd === 'voicelogs') return handleIndividualLogToggle('voice', 'Connexions & Déconnexions Vocales');
    if (cmd === 'boostlogs') return handleIndividualLogToggle('boost', 'Boosts de Serveur');
    if (cmd === 'captchalogs') return handleIndividualLogToggle('captcha', 'Vérifications Captcha');

    // ═══════════════════════════════════════════════════════════════════════
    // MODULE AUTOMATISATION & COMMUNAUTÉ (+autoperm, +automods, +autopublish, +autoreact, +captcha, +counter)
    // ═══════════════════════════════════════════════════════════════════════

    // ─── +autoperm ────────────────────────────────────────────────────────
    if (cmd === 'autoperm') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Permission Administrateur requise pour AutoPerm.');
        }

        try {
            await message.guild.roles.everyone.setPermissions(
                message.guild.roles.everyone.permissions.remove([
                    PermissionsBitField.Flags.MentionEveryone,
                    PermissionsBitField.Flags.Administrator,
                    PermissionsBitField.Flags.ManageGuild,
                    PermissionsBitField.Flags.ManageRoles,
                    PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.BanMembers,
                    PermissionsBitField.Flags.KickMembers,
                    PermissionsBitField.Flags.ModerateMembers,
                    PermissionsBitField.Flags.ManageWebhooks
                ]),
                'AutoPerm: Sécurisation automatique du rôle @everyone'
            );

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '🛡️ AutoPerm · Rôles et Permissions Sécurisés',
                    description: `Le rôle **@everyone** a été verrouillé contre les abus et failles de sécurité.`,
                    fields: [
                        { name: 'Permissions révoquées pour @everyone', value: '• Mentionner @everyone / @here\n• Droits Administrateur\n• Gérer le serveur & les webhooks\n• Gérer les salons & rôles\n• Bannir / Expulser / Mute', inline: false }
                    ]
                })]
            });
        } catch (e) {
            console.error('[AUTOPERM] Erreur modification perms:', e);
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '❌ Erreur', description: 'Impossible de modifier les permissions du rôle @everyone.' })] });
        }
    }

    // ─── +automods ────────────────────────────────────────────────────────
    if (cmd === 'automods') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Permission Gérer le serveur requise pour configurer l\'AutoMod.');
        }

        try {
            // Création règle Anti-Mention Spam native Discord
            await message.guild.autoModerationRules.create({
                name: 'Supreme Anti-Mention Spam',
                eventType: 1, // MESSAGE_SEND
                triggerType: 5, // MENTION_SPAM
                triggerMetadata: { mentionTotalLimit: 5 },
                actions: [{ type: 1 }] // BLOCK_MESSAGE
            }).catch(() => {});

            // Création règle Anti-Invites Discord
            await message.guild.autoModerationRules.create({
                name: 'Supreme Anti-Invitations',
                eventType: 1,
                triggerType: 1, // KEYWORD
                triggerMetadata: {
                    keywordFilter: ['*discord.gg/*', '*discord.com/invite/*', '*discordapp.com/invite/*']
                },
                actions: [{ type: 1 }]
            }).catch(() => {});

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '🤖 Règles AutoMod Discord Actives',
                    description: 'Règles natives Discord AutoMod générées avec succès (Anti-Mention Spam & Anti-Liens d\'invitations externes).'
                })]
            });
        } catch (e) {
            console.error('[AUTOMODS] Erreur:', e);
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '❌ Erreur', description: 'Impossible de configurer les règles AutoMod (vérifiez mes permissions "Gérer le serveur").' })] });
        }
    }

    // ─── +autopublish [#salon/all/off] ────────────────────────────────────
    if (cmd === 'autopublish') {
        if (!isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire requise.');
        }
        const sub = args[0]?.toLowerCase();
        if (sub === 'all') {
            db.autoPublish = ['all'];
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '📢 Auto-Publish Activé (Tous les Salons)', description: 'Tous les messages postés dans n\'importe quel salon d\'annonces seront automatiquement publiés.' })] });
        }
        if (sub === 'off' || sub === 'disable') {
            db.autoPublish = [];
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '📢 Auto-Publish Désactivé', description: 'La publication automatique est coupée.' })] });
        }

        const targetChan = message.mentions.channels.first() || (sub ? message.guild.channels.cache.get(sub.replace(/[<#>]/g, '')) : message.channel);
        if (db.autoPublish.includes(targetChan.id)) {
            db.autoPublish = db.autoPublish.filter(id => id !== targetChan.id);
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '📢 Auto-Publish Retiré', description: `Le salon ${targetChan} n'est plus en auto-publication.` })] });
        } else {
            db.autoPublish.push(targetChan.id);
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '📢 Auto-Publish Activé', description: `Les messages du salon ${targetChan} seront automatiquement diffusés.` })] });
        }
    }

    // ─── +autoreact <#salon> <emojis...> ──────────────────────────────────
    if (cmd === 'autoreact') {
        if (!isManager(message.member)) {
            return replyPermissionDenied(message, 'Permission Gestionnaire requise.');
        }
        const sub = args[0]?.toLowerCase();
        if (sub === 'list') {
            const list = Object.entries(db.autoReact).map(([chId, emojis]) => `• <#${chId}> : ${emojis.join(' ')}`).join('\n') || '*Aucun auto-react configuré.*';
            return message.reply({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: '✨ Liste des Auto-Réactions', description: list })] });
        }

        const targetChan = message.mentions.channels.first() || message.channel;
        const emojis = args.filter(a => !a.startsWith('<#') && a !== targetChan.id);

        if (emojis.length === 0) {
            if (db.autoReact[targetChan.id]) {
                delete db.autoReact[targetChan.id];
                saveData();
                return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '✨ Auto-React Retiré', description: `Auto-réactions retirées pour ${targetChan}.` })] });
            }
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}autoreact [#salon] <emoji1> [emoji2...]\`` })] });
        }

        db.autoReact[targetChan.id] = emojis;
        saveData();

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.SUCCESS,
                title: '✨ Auto-React Configuré',
                description: `Chaque nouveau message dans ${targetChan} recevra automatiquement : ${emojis.join(' ')}`
            })]
        });
    }

    // ─── +captcha [setup #salon @role / off] ──────────────────────────────
    if (cmd === 'captcha') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Permission Administrateur requise pour le captcha.');
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'off' || sub === 'disable') {
            db.captchaConfig.enabled = false;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '🤖 Captcha Désactivé', description: 'Le système de vérification captcha est mis en veille.' })] });
        }

        if (sub === 'setup' || message.mentions.roles.first()) {
            const role = message.mentions.roles.first() || (args[2] ? message.guild.roles.cache.get(args[2].replace(/[<@&>]/g, '')) : null);
            const channel = message.mentions.channels.first() || message.channel;

            if (!role) {
                return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Syntaxe', description: `Usage : \`${PREFIX}captcha setup [#salon] <@rôle_vérifié>\`` })] });
            }

            db.captchaConfig = {
                enabled: true,
                roleId: role.id,
                channelId: channel.id
            };
            saveData();

            const panelEmbed = makeEmbed({
                color: COLORS.PURPLE,
                title: '🛡️ Portail de Vérification de Sécurité',
                description: `Pour accéder à l'intégralité du serveur **${message.guild.name}**, veuillez cliquer sur le bouton ci-dessous pour confirmer que vous n'êtes pas un bot.\n\n*Une fois validé, le rôle ${role} vous sera automatiquement attribué.*`
            });

            const verifyButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('captcha_verify_btn')
                    .setLabel('🛡️ Vérifier mon compte')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

            await channel.send({ embeds: [panelEmbed], components: [verifyButton] });
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🤖 Système Captcha Actif', description: `Le portail de vérification a été déployé dans ${channel} avec le rôle ${role}.` })] });
        }

        const status = db.captchaConfig.enabled
            ? `🟢 **Actif**\n• Salon : <#${db.captchaConfig.channelId}>\n• Rôle : <@&${db.captchaConfig.roleId}>`
            : '🔴 **Désactivé**';

        return message.reply({
            embeds: [makeEmbed({
                color: COLORS.PRIMARY,
                title: '🤖 Statut du Système Captcha',
                description: `${status}\n\n*Pour configurer : \`${PREFIX}captcha setup [#salon] <@rôle>\`*`
            })]
        });
    }

    // ─── +counter [setup / off / update] ──────────────────────────────────
    if (cmd === 'counter' || cmd === 'compteur') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isOwner(message.author.id, message.guild)) {
            return replyPermissionDenied(message, 'Permission Administrateur requise pour les compteurs.');
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'off' || sub === 'disable') {
            db.counterConfig.enabled = false;
            saveData();
            return message.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '📊 Compteurs Désactivés', description: 'Les compteurs automatiques ont été désactivés.' })] });
        }

        if (sub === 'update') {
            await updateServerCounters(message.guild);
            return message.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🔄 Compteurs Actualisés', description: 'Les salons statistiques ont été mis à jour.' })] });
        }

        // Configuration / Création automatique
        try {
            const cat = await message.guild.channels.create({
                name: '📊・STATISTIQUES',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: message.guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.Connect],
                        allow: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            const memChan = await message.guild.channels.create({
                name: `👥・Membres : ${message.guild.memberCount}`,
                type: ChannelType.GuildVoice,
                parent: cat.id
            });

            const voiceCount = message.guild.members.cache.filter(m => m.voice?.channelId).size;
            const vChan = await message.guild.channels.create({
                name: `🔊・En Vocal : ${voiceCount}`,
                type: ChannelType.GuildVoice,
                parent: cat.id
            });

            db.counterConfig = {
                enabled: true,
                categoryId: cat.id,
                membersChannelId: memChan.id,
                voiceChannelId: vChan.id
            };
            saveData();

            return message.reply({
                embeds: [makeEmbed({
                    color: COLORS.SUCCESS,
                    title: '📊 Salons Compteurs Créés',
                    description: `Les salons statistiques vocaux ont été déployés et se mettront à jour en temps réel :\n• **Membres :** ${memChan}\n• **En Vocal :** ${vChan}`
                })]
            });
        } catch (e) {
            console.error('[COUNTER] Erreur création compteurs:', e);
            return message.reply({ embeds: [makeEmbed({ color: COLORS.DANGER, title: '❌ Erreur', description: 'Impossible de créer les salons compteurs (vérifiez mes permissions "Gérer les salons").' })] });
        }
    }
});

// ─── SERVEUR WEB HEALTH CHECK (Indispensable pour Render Web Service Free) ──
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            service: 'SupremeBot Gestion',
            bot: client.user ? client.user.tag : 'connecting',
            uptime: Math.floor(process.uptime()),
            ping: client.ws.ping
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[HTTP] Serveur Web Health Check actif sur le port ${PORT} (Prêt pour Render)`);
});

client.login(process.env.DISCORD_TOKEN);
