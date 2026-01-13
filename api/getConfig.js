module.exports = (req, res) => {
    res.json({
        GCclientId: "f65fd35a-4956-4b1c-89e7-a30d6aa65f78",//process.env.GC_OAUTH_CLIENT_ID,
        DDIlist: "+972776936026"//process.env.DDI_LIST
    });
};
