import { getDatabase } from './database.js'
import { createCustomEntity } from './customEntities.js'
import { createCustomEntityRow } from './customEntityCrud.js'
import { createRelationshipDefinition } from './relationshipsStore.js'
import { createOntologyRule } from './rulesStore.js'

/* Namespace for Physical AI / autonomous drone ontology entities and predicates. */
const BASE_IRI = 'http://physicalai.example/drone#'

const SHACL_VIOLATION = 'http://www.w3.org/ns/shacl#Violation'

/* Return true if this seed package was already applied (idempotent). */
function isDroneOntologySeeded(database) {
  const row = database.prepare(`SELECT 1 AS ok FROM custom_entities WHERE entity_name = 'drone_platform' LIMIT 1`).get()
  return Boolean(row?.ok)
}

/* Insert a relationship definition if the same name is not already stored. */
function ensureRelationshipDefinition(database, definition) {
  const existing = database
    .prepare(`SELECT id FROM relationship_definitions WHERE relationship_name = ? LIMIT 1`)
    .get(definition.relationship_name)
  if (existing) {
    return
  }
  createRelationshipDefinition(definition)
}

/* Insert an ontology rule if no rule with the same name exists. */
function ensureOntologyRule(database, ruleInput) {
  const existing = database.prepare(`SELECT id FROM ontology_rules WHERE rule_name = ? LIMIT 1`).get(ruleInput.rule_name)
  if (existing) {
    return
  }
  createOntologyRule({
    rule_kind: 'constraint',
    severity_iri: SHACL_VIOLATION,
    is_enabled: 1,
    ...ruleInput,
  })
}

/* Optionally align global base IRI with the drone namespace when still at factory default. */
function alignDefaultBaseIri(database) {
  const row = database.prepare(`SELECT base_iri FROM ontology_settings WHERE id = 1`).get()
  if (row && String(row.base_iri) === 'http://example.com/context#') {
    database.prepare(`UPDATE ontology_settings SET base_iri = ? WHERE id = 1`).run(BASE_IRI)
  }
}

/**
 * Seed custom entities, relationships, SHACL-style rules, and demo rows for
 * autonomous drone missions. Safe to call on every startup; skips work when already applied.
 */
export function seedDroneOntology() {
  const database = getDatabase()

  if (isDroneOntologySeeded(database)) {
    return { seeded: false, reason: 'already_present' }
  }

  alignDefaultBaseIri(database)

  createCustomEntity({
    entity_name: 'drone_platform',
    display_name: 'Drone platform',
    base_iri: BASE_IRI,
    fields: [
      { field_name: 'name', field_type: 'TEXT', is_required: true },
      { field_name: 'model', field_type: 'TEXT', is_required: false },
      { field_name: 'manufacturer', field_type: 'TEXT', is_required: false },
      { field_name: 'serial_number', field_type: 'TEXT', is_required: false },
      { field_name: 'max_takeoff_mass_kg', field_type: 'REAL', is_required: false },
      { field_name: 'flight_controller', field_type: 'TEXT', is_required: false },
      { field_name: 'firmware_version', field_type: 'TEXT', is_required: false },
      { field_name: 'autonomy_level', field_type: 'TEXT', is_required: false },
    ],
  })

  createCustomEntity({
    entity_name: 'autonomy_policy',
    display_name: 'Autonomy policy',
    base_iri: BASE_IRI,
    fields: [
      { field_name: 'policy_name', field_type: 'TEXT', is_required: true },
      { field_name: 'version', field_type: 'TEXT', is_required: false },
      { field_name: 'obstacle_behavior', field_type: 'TEXT', is_required: false },
      { field_name: 'lost_link_behavior', field_type: 'TEXT', is_required: false },
      { field_name: 'max_altitude_m', field_type: 'REAL', is_required: false },
      { field_name: 'max_speed_m_s', field_type: 'REAL', is_required: false },
    ],
  })

  createCustomEntity({
    entity_name: 'sensor_payload',
    display_name: 'Sensor payload',
    base_iri: BASE_IRI,
    fields: [
      { field_name: 'drone_platform_id', field_type: 'INTEGER', is_required: false },
      { field_name: 'payload_name', field_type: 'TEXT', is_required: true },
      { field_name: 'modality', field_type: 'TEXT', is_required: false },
      { field_name: 'resolution_detail', field_type: 'TEXT', is_required: false },
      { field_name: 'max_fps', field_type: 'REAL', is_required: false },
      { field_name: 'mount_location', field_type: 'TEXT', is_required: false },
    ],
  })

  createCustomEntity({
    entity_name: 'mission',
    display_name: 'Drone mission',
    base_iri: BASE_IRI,
    fields: [
      { field_name: 'drone_platform_id', field_type: 'INTEGER', is_required: false },
      { field_name: 'autonomy_policy_id', field_type: 'INTEGER', is_required: false },
      { field_name: 'mission_name', field_type: 'TEXT', is_required: true },
      { field_name: 'mission_type', field_type: 'TEXT', is_required: false },
      { field_name: 'planned_duration_min', field_type: 'REAL', is_required: false },
      { field_name: 'risk_class', field_type: 'TEXT', is_required: false },
      { field_name: 'geofence_policy', field_type: 'TEXT', is_required: false },
    ],
  })

  createCustomEntity({
    entity_name: 'waypoint',
    display_name: 'Mission waypoint',
    base_iri: BASE_IRI,
    fields: [
      { field_name: 'mission_id', field_type: 'INTEGER', is_required: true },
      { field_name: 'sequence_index', field_type: 'INTEGER', is_required: true },
      { field_name: 'latitude', field_type: 'REAL', is_required: false },
      { field_name: 'longitude', field_type: 'REAL', is_required: false },
      { field_name: 'altitude_agl_m', field_type: 'REAL', is_required: false },
      { field_name: 'hover_seconds', field_type: 'REAL', is_required: false },
      { field_name: 'cruise_speed_m_s', field_type: 'REAL', is_required: false },
    ],
  })

  createCustomEntity({
    entity_name: 'flight_operation',
    display_name: 'Flight operation',
    base_iri: BASE_IRI,
    fields: [
      { field_name: 'mission_id', field_type: 'INTEGER', is_required: false },
      { field_name: 'drone_platform_id', field_type: 'INTEGER', is_required: false },
      { field_name: 'operation_label', field_type: 'TEXT', is_required: true },
      { field_name: 'started_at', field_type: 'TEXT', is_required: false },
      { field_name: 'ended_at', field_type: 'TEXT', is_required: false },
      { field_name: 'pilot_in_command', field_type: 'TEXT', is_required: false },
      { field_name: 'weather_summary', field_type: 'TEXT', is_required: false },
      { field_name: 'outcome', field_type: 'TEXT', is_required: false },
    ],
  })

  ensureRelationshipDefinition(database, {
    relationship_name: 'mounted_on_platform',
    subject_entity: 'sensor_payload',
    subject_column: 'drone_platform_id',
    predicate_iri: `${BASE_IRI}mountedOnPlatform`,
    object_entity: 'drone_platform',
    object_column: 'id',
  })

  ensureRelationshipDefinition(database, {
    relationship_name: 'mission_assigned_platform',
    subject_entity: 'mission',
    subject_column: 'drone_platform_id',
    predicate_iri: `${BASE_IRI}assignedPlatform`,
    object_entity: 'drone_platform',
    object_column: 'id',
  })

  ensureRelationshipDefinition(database, {
    relationship_name: 'mission_governed_by_policy',
    subject_entity: 'mission',
    subject_column: 'autonomy_policy_id',
    predicate_iri: `${BASE_IRI}governedByPolicy`,
    object_entity: 'autonomy_policy',
    object_column: 'id',
  })

  ensureRelationshipDefinition(database, {
    relationship_name: 'waypoint_belongs_to_mission',
    subject_entity: 'waypoint',
    subject_column: 'mission_id',
    predicate_iri: `${BASE_IRI}belongsToMission`,
    object_entity: 'mission',
    object_column: 'id',
  })

  ensureRelationshipDefinition(database, {
    relationship_name: 'operation_follows_mission',
    subject_entity: 'flight_operation',
    subject_column: 'mission_id',
    predicate_iri: `${BASE_IRI}followsMission`,
    object_entity: 'mission',
    object_column: 'id',
  })

  ensureRelationshipDefinition(database, {
    relationship_name: 'operation_on_platform',
    subject_entity: 'flight_operation',
    subject_column: 'drone_platform_id',
    predicate_iri: `${BASE_IRI}usesPlatform`,
    object_entity: 'drone_platform',
    object_column: 'id',
  })

  ensureOntologyRule(database, {
    rule_name: 'drone_autonomy_level_enum',
    target_entity: 'drone_platform',
    property_iri: `${BASE_IRI}autonomyLevel`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['manual', 'supervised', 'autonomous'],
    message: 'autonomy_level must be manual, supervised, or autonomous.',
  })

  ensureOntologyRule(database, {
    rule_name: 'mission_type_enum',
    target_entity: 'mission',
    property_iri: `${BASE_IRI}missionType`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['survey', 'inspect', 'delivery', 'patrol', 'training', 'research'],
    message: 'mission_type must be one of the approved mission categories.',
  })

  ensureOntologyRule(database, {
    rule_name: 'mission_risk_class_enum',
    target_entity: 'mission',
    property_iri: `${BASE_IRI}riskClass`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['low', 'medium', 'high'],
    message: 'risk_class must be low, medium, or high.',
  })

  ensureOntologyRule(database, {
    rule_name: 'sensor_modality_enum',
    target_entity: 'sensor_payload',
    property_iri: `${BASE_IRI}modality`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['EO', 'IR', 'LiDAR', 'RADAR', 'GNSS', 'IMU', 'multispectral'],
    message: 'modality must use a supported sensor modality code.',
  })

  ensureOntologyRule(database, {
    rule_name: 'policy_obstacle_behavior_enum',
    target_entity: 'autonomy_policy',
    property_iri: `${BASE_IRI}obstacleBehavior`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['stop', 'bypass', 'hover', 'replan'],
    message: 'obstacle_behavior must be stop, bypass, hover, or replan.',
  })

  ensureOntologyRule(database, {
    rule_name: 'policy_lost_link_enum',
    target_entity: 'autonomy_policy',
    property_iri: `${BASE_IRI}lostLinkBehavior`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['RTL', 'hover', 'land', 'hold'],
    message: 'lost_link_behavior must be RTL, hover, land, or hold.',
  })

  ensureOntologyRule(database, {
    rule_name: 'flight_outcome_enum',
    target_entity: 'flight_operation',
    property_iri: `${BASE_IRI}outcome`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#string',
    allowed_values: ['success', 'partial', 'aborted', 'emergency'],
    message: 'outcome must be success, partial, aborted, or emergency.',
  })

  ensureOntologyRule(database, {
    rule_name: 'waypoint_latitude_range',
    target_entity: 'waypoint',
    property_iri: `${BASE_IRI}latitude`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#decimal',
    pattern: '^-?([0-8]?[0-9]|90)(\\.[0-9]+)?$',
    message: 'latitude should be a decimal degrees value between -90 and 90.',
  })

  ensureOntologyRule(database, {
    rule_name: 'waypoint_longitude_range',
    target_entity: 'waypoint',
    property_iri: `${BASE_IRI}longitude`,
    datatype_iri: 'http://www.w3.org/2001/XMLSchema#decimal',
    pattern: '^-?([0-9]{1,2}|1[0-7][0-9]|180)(\\.[0-9]+)?$',
    message: 'longitude should be a decimal degrees value between -180 and 180.',
  })

  const platformRow = createCustomEntityRow('drone_platform', {
    name: 'Alpha survey quad',
    model: 'PAI-Q400',
    manufacturer: 'Example Aero',
    serial_number: 'UAS-PAI-2026-001',
    max_takeoff_mass_kg: 8.5,
    flight_controller: 'PX4',
    firmware_version: '1.14.3',
    autonomy_level: 'supervised',
  })

  const policyRow = createCustomEntityRow('autonomy_policy', {
    policy_name: 'BVLOS survey baseline',
    version: '2026-05',
    obstacle_behavior: 'replan',
    lost_link_behavior: 'RTL',
    max_altitude_m: 120,
    max_speed_m_s: 15,
  })

  createCustomEntityRow('sensor_payload', {
    drone_platform_id: platformRow.id,
    payload_name: 'Gimbal EO RGB',
    modality: 'EO',
    resolution_detail: '20 MP / 4K video',
    max_fps: 60,
    mount_location: 'nose_gimbal',
  })

  const missionRow = createCustomEntityRow('mission', {
    drone_platform_id: platformRow.id,
    autonomy_policy_id: policyRow.id,
    mission_name: 'Corridor LIDAR + RGB survey',
    mission_type: 'survey',
    planned_duration_min: 42,
    risk_class: 'medium',
    geofence_policy: 'Class_G_below_400ft',
  })

  createCustomEntityRow('waypoint', {
    mission_id: missionRow.id,
    sequence_index: 0,
    latitude: 45.5017,
    longitude: -73.5673,
    altitude_agl_m: 50,
    hover_seconds: 0,
    cruise_speed_m_s: 12,
  })

  createCustomEntityRow('waypoint', {
    mission_id: missionRow.id,
    sequence_index: 1,
    latitude: 45.503,
    longitude: -73.56,
    altitude_agl_m: 50,
    hover_seconds: 5,
    cruise_speed_m_s: 10,
  })

  createCustomEntityRow('flight_operation', {
    mission_id: missionRow.id,
    drone_platform_id: platformRow.id,
    operation_label: 'Training sortie T-14',
    started_at: '2026-05-01T14:00:00Z',
    ended_at: '2026-05-01T14:38:00Z',
    pilot_in_command: 'Remote PIC certificate #RPC-7788',
    weather_summary: 'wind 12 kt gusting 18 kt, visibility 8 km',
    outcome: 'success',
  })

  return {
    seeded: true,
    demo: {
      drone_platform_id: platformRow.id,
      autonomy_policy_id: policyRow.id,
      mission_id: missionRow.id,
    },
  }
}
