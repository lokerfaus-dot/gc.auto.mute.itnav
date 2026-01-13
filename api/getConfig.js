module.exports = (req, res) => {
    res.json({
        GCclientId: process.env.GC_OAUTH_CLIENT_ID,
        DDIlist: process.env.DDI_LIST
    });
};
