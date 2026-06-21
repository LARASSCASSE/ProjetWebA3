const Post = require("../models/post.model");

const STAFF = ["moderator", "admin"];

// POST /api/posts
exports.create = async (req, res) => {
  try {
    const { content, tags, imageUrl, videoUrl } = req.body;
    if (!content || !content.trim())
      return res.status(400).json({ message: "Le contenu est requis" });
    if (content.length > 280)
      return res.status(400).json({ message: "280 caractères maximum" });

    const post = await Post.create({
      authorId: req.user.id,
      content: content.trim(),
      tags: tags || [],
      imageUrl: imageUrl || "",
      videoUrl: videoUrl || "",
    });
    return res.status(201).json(post);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/posts  (fil chronologique global — MVP avant le feed personnalisé)
exports.list = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    return res.json(posts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/posts/search?tag=xxx
exports.search = async (req, res) => {
  try {
    const { tag } = req.query;
    if (!tag) return res.status(400).json({ message: "Paramètre 'tag' requis" });
    const posts = await Post.find({ tags: tag }).sort({ createdAt: -1 }).limit(50);
    return res.json(posts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/posts/:id
exports.getById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post introuvable" });
    return res.json(post);
  } catch (err) {
    return res.status(400).json({ message: "Identifiant invalide" });
  }
};

// PUT /api/posts/:id  (auteur OU modérateur/admin)
exports.update = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post introuvable" });

    const isOwner = post.authorId === req.user.id;
    const isStaff = STAFF.includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ message: "Action non autorisée" });

    if (typeof req.body.content === "string") {
      if (req.body.content.length > 280)
        return res.status(400).json({ message: "280 caractères maximum" });
      post.content = req.body.content.trim();
    }
    await post.save();
    return res.json(post);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// DELETE /api/posts/:id  (auteur OU modérateur/admin)
exports.remove = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post introuvable" });

    const isOwner = post.authorId === req.user.id;
    const isStaff = STAFF.includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ message: "Action non autorisée" });

    await post.deleteOne();
    return res.status(204).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
