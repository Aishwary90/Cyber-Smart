function buildCategoryPayload(category) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.crime_name || category.title,
    title: category.title || category.crime_name || "",
    type: category.type || null,
    description: category.description || "",
    severity: category.severity || "medium",
    it_act_sections: category.legal_sections?.it_act || category.it_act_sections || [],
    ipc_sections: category.legal_sections?.ipc || category.ipc_sections || [],
    evidence_to_collect: category.evidence_required || category.evidence_to_collect || [],
    immediate_actions: category.immediate_actions || [],
    legal_summary: category.legal_summary || "",
    reporting: category.reporting || null,
    timeline_guidance: category.timeline_guidance || null,
    case_study: category.case_study || null,
    not_crime_data: category.not_crime_data || null,
  };
}

module.exports = { buildCategoryPayload };
