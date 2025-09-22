import mongoose from 'mongoose';

const pageLayoutSchema = new mongoose.Schema({
  sections: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  }
}, {
  timestamps: true
});

// Ensure a singleton document pattern
pageLayoutSchema.statics.getOrCreate = async function() {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({ sections: [] });
  }
  return doc;
};

const PageLayout = mongoose.model('PageLayout', pageLayoutSchema);

export default PageLayout;
