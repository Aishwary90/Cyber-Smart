const path = require("path");

const catalog = require(path.join(__dirname, "../data/normalized_incident_catalog.json"));

const categories = catalog.categories || [];
const categoryMap = new Map(categories.map((category) => [category.id, category]));
const crimeCategories = categories.filter((category) => category.type === "crime");
const notCrimeCategories = categories.filter((category) => category.type === "not_crime");

function getCatalogMeta() {
  return catalog.meta || {};
}

function getAllCategories() {
  return categories;
}

function getCrimeCategories() {
  return crimeCategories;
}

function getNotCrimeCategories() {
  return notCrimeCategories;
}

function getCategoryById(id) {
  return categoryMap.get(id) || null;
}

function isCrimeId(id) {
  return Boolean(id && getCategoryById(id)?.type === "crime");
}

function isNotCrimeId(id) {
  return Boolean(id && getCategoryById(id)?.type === "not_crime");
}

module.exports = {
  getCatalogMeta,
  getAllCategories,
  getCrimeCategories,
  getNotCrimeCategories,
  getCategoryById,
  isCrimeId,
  isNotCrimeId,
};
