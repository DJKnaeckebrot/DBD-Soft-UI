module.exports = function (config, themeConfig) {
    config.guildSettings = async function (req, res, home, category) {
        if (!req.session.user) return res.redirect('/discord?r=/guild/' + req.params.id);

        let bot = config.bot;
        if (!bot.guilds.cache.get(req.params.id)) {
            try {
                await bot.guilds.fetch(req.params.id);
            } catch (err) { }
        }

        if (!bot.guilds.cache.get(req.params.id)) return res.redirect('/manage?error=noPermsToManageGuild');
        if (!bot.guilds.cache.get(req.params.id).members.cache.get(req.session.user.id)) {
            try {
                await bot.guilds.cache.get(req.params.id).members.fetch(req.session.user.id);
            } catch (err) { }
        }
        for (let PermissionRequired of req.requiredPermissions) {
            if (!bot.guilds.cache.get(req.params.id).members.cache.get(req.session.user.id).permissions.has(PermissionRequired[0])) return res.redirect('/manage?error=noPermsToManageGuild');
        }

        if (bot.guilds.cache.get(req.params.id).channels.cache.size < 1) {
            try {
                await bot.guilds.cache.get(req.params.id).channels.fetch();
            } catch (err) {
            }
        }

        if (bot.guilds.cache.get(req.params.id).roles.cache.size < 2) {
            try {
                await bot.guilds.cache.get(req.params.id).roles.fetch();
            } catch (err) {
            }
        }

        let actual = {};
        let toggle = {};
        let premium = {};

        let canUseList = {};
        for (const s of config.settings) {
            if (!canUseList[s.categoryId]) canUseList[s.categoryId] = {};
            if (s.toggleable) {
                if (!toggle[s.categoryId]) {
                    toggle[s.categoryId] = {};
                }
                toggle[s.categoryId] = await s.getActualSet({
                    guild: {
                        id: req.params.id
                    }
                });
            }
            if (s.premium) {
                if (!premium[s.categoryId]) {
                    premium[s.categoryId] = {};
                }
                premium[s.categoryId] = await s.premiumUser({
                    guild: {
                        id: req.params.id
                    },
                    user: {
                        id: req.session.user.id,
                        tag: req.session.user.tag
                    }
                });
            }

            if (category) {
                if (s.premium && premium[category] == false) {
                    return res.redirect(`/settings/${req.params.id}?error=premiumRequired`);
                }
            }

            for (const c of s.categoryOptionsList) {
                if (c.allowedCheck) {
                    const canUse = await c.allowedCheck({
                        guild: { id: req.params.id },
                        user: { id: req.session.user.id }
                    });
                    if (typeof (canUse) != 'object') throw new TypeError(`${s.categoryId} category option with id ${c.optionId} allowedCheck function need to return {allowed: Boolean, errorMessage: String | null}`);
                    canUseList[s.categoryId][c.optionId] = canUse;
                } else {
                    canUseList[s.categoryId][c.optionId] = { allowed: true, errorMessage: null };
                }

                if (!actual[s.categoryId]) actual[s.categoryId] = {};

                if (c.optionType == 'spacer') {
                } else if (c.optionType.type == 'collapsable' || c.optionType.type == 'modal') {
                    for (const item of c.optionType.options) {
                        if (item.optionType.type == 'channelsMultiSelect' || item.optionType.type == 'roleMultiSelect' || item.optionType.type == 'tagInput') actual[s.categoryId][item.optionId] = [];
                    }
                } else {
                    if (!actual[s.categoryId]) {
                        actual[s.categoryId] = {};
                    }
                    if (!actual[s.categoryId][c.optionId]) {
                        actual[s.categoryId][c.optionId] = await c.getActualSet({
                            guild: {
                                id: req.params.id,
                                object: bot.guilds.cache.get(req.params.id),
                            },
                            user: {
                                id: req.session.user.id,
                                object: bot.guilds.cache.get(req.params.id).members.cache.get(req.session.user.id),
                            }
                        });
                    }
                }
            }
        }

        let errors;
        let success;

        if (req.session.errors) {
            if (String(req.session.errors).includes('%is%')) {
                errors = req.session.errors.split('%and%');
            }
        }

        if (req.session.success) {
            if (typeof (req.session.success) == 'boolean') {
                success = true;
            } else {
                if (String(req.session.success).includes('%is%')) {
                    success = req.session.success.split('%and%');
                }
            }
        }

        req.session.errors = null;
        req.session.success = null;

        const guild = bot.guilds.cache.get(req.params.id);
        let gIcon;

        if (!guild.iconURL()) gIcon = themeConfig.icons.noGuildIcon;
        else gIcon = guild.iconURL();

        res.render('settings', {
            successes: success,
            errors: errors,
            settings: config.settings,
            actual: actual,
            toggle,
            premium,
            canUseList,
            bot: config.bot,
            guild,
            gIcon,
            req: req,
            guildid: req.params.id,
            themeConfig: req.themeConfig,
            config,
        });
    }
}