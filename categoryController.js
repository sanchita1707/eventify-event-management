const Category = require('../models/Category');
const Event = require('../models/Event');

// @desc    Get all categories with event counts
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    // Count approved & published public events per category
    const counts = await Event.aggregate([
      {
        $match: {
          approvalStatus: 'approved',
          isPublished: { $ne: false },
          isDraft: { $ne: true },
          status: { $nin: ['cancelled', 'draft'] }
        }
      },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    counts.forEach((c) => {
      if (c._id) countMap[c._id.toString()] = c.count;
    });

    const data = categories.map((cat) => ({
      ...cat.toObject(),
      eventCount: countMap[cat._id.toString()] || 0
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      categories: data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new category (Admin)
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    const { name, icon, color, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      icon: icon || 'fa-calendar-check',
      color: color || '#6C3CE9',
      description: description || ''
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a category (Admin)
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, icon, color, description, isActive } = req.body;
    if (name) {
      category.name = name.trim();
      category.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a category (Admin)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await category.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Category removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

