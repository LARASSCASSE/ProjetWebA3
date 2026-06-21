const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, index: true },
    content:  { type: String, required: true, maxlength: 280, trim: true },
    tags:     { type: [String], default: [], index: true },
    imageUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
  },
  { timestamps: true } // createdAt / updatedAt
);

module.exports = mongoose.model("Post", postSchema);
