/** Canonical optional HD humanoid enemy wave; binaries distributed in the review archive. */
export const HD_HUMANOID_ENEMY_WAVE = Object.freeze([
 {id:'mourning-ronin',group:'enemy',source:'individual-painted-3x2',weapon:'katana'},
 {id:'ashen-spearman',group:'enemy',source:'individual-painted-3x2',weapon:'spear'},
 {id:'court-arquebusier',group:'enemy',source:'individual-painted-3x2',weapon:'matchlock'},
 {id:'bell-scribe',group:'enemy',source:'individual-painted-3x2',weapon:'ritual-paper'},
 {id:'tithe-enforcer',group:'enemy',source:'quarter-panel-painted-3x2',weapon:'glaive'},
 {id:'drowned-retainer',group:'enemy',source:'quarter-panel-painted-3x2',weapon:'katana'},
 {id:'salt-warden',group:'enemy',source:'quarter-panel-painted-3x2',weapon:'shield'},
 {id:'ashen-banner-guard',group:'enemy',source:'quarter-panel-painted-3x2',weapon:'banner'},
]);
export const HD_HUMANOID_CLIPS = Object.freeze([
 'idle','locomotion','windup','active','recovery',
 'guard','hurt','defeat','signature','stagger',
]);
export const HD_REGULAR_ENEMY_TOTAL = 28;
export const HD_REGULAR_ENEMY_COMPLETED = 12;
export const HD_PENDING_ENEMIES = Object.freeze({
 initialV2:['ash-wisp','registry-hound','lantern-leech','forge-thrall'],
 humanV3:['veil-courier','provincial-banner-guard'],
 beastV3:['storm-nue','dream-baku','twin-tail-nekomata','sickle-weasel','drum-tanuki','marsh-kappa-beast','ushi-oni-behemoth'],
 plantV3:['black-chrysanthemum-nest-woman','spider-lily-ambusher','lantern-vine-maw'],
});
export const HD_PENDING_BOSSES = Object.freeze([
 'captain-kaji','widow-of-fog','furnace-abbot','ujiro','bell-warden-chiyo','lady-enma','yearless-bell'
]);
