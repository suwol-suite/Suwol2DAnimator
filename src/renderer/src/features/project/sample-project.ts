import type {
  ImportedImage,
  Suwol2DClippingAttachment,
  Suwol2DDocument,
  Suwol2DMeshAttachment,
  Suwol2DTransformConstraint,
  Suwol2DVertexOffset
} from '../../../../shared/suwol2d-format';
import { cloneAttachment, cloneAttachments, syncTopLevelAttachmentsFromSkins } from '../../../../shared/skins.ts';

export function createSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const bodyImage = images.find((image) => image.name === 'body') ?? images[0];
  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];

  const document: Suwol2DDocument = {
    version: 0,
    name: 'sample_character',
    bones: [
      { name: 'root', parent: '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'body', parent: 'root', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'arm', parent: 'body', x: 0.48, y: 0.2, rotation: -12, scaleX: 1, scaleY: 1 }
    ],
    slots: [
      { name: 'body_slot', bone: 'body', attachment: 'body', drawOrder: 0 },
      { name: 'arm_slot', bone: 'arm', attachment: 'arm', drawOrder: 1 }
    ],
    skins: [{ name: 'default', attachments: [] }],
    attachments: [
      {
        name: 'body',
        slot: 'body_slot',
        type: 'region',
        image: bodyImage?.name ?? 'body',
        x: 0,
        y: 0,
        rotation: 0,
        width: 0.9,
        height: 1.35,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'arm',
        slot: 'arm_slot',
        type: 'region',
        image: armImage?.name ?? 'arm',
        x: 0.2,
        y: -0.25,
        rotation: -18,
        width: 0.26,
        height: 0.85,
        scaleX: 1,
        scaleY: 1
      }
    ],
    animations: [
      {
        name: 'idle',
        loop: true,
        bones: [
          {
            bone: 'root',
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 0.5, x: 0, y: 0.16 },
              { time: 1, x: 0, y: 0 }
            ],
            rotate: [],
            scale: []
          },
          {
            bone: 'body',
            translate: [],
            rotate: [
              { time: 0, rotation: -7 },
              { time: 0.5, rotation: 7 },
              { time: 1, rotation: -7 }
            ],
            scale: []
          }
        ]
      },
      {
        name: 'walk',
        loop: true,
        bones: [
          {
            bone: 'root',
            translate: [
              { time: 0, x: -0.1, y: 0 },
              { time: 0.25, x: 0.1, y: 0.08 },
              { time: 0.5, x: -0.1, y: 0 }
            ],
            rotate: [],
            scale: []
          },
          {
            bone: 'arm',
            translate: [],
            rotate: [
              { time: 0, rotation: -65 },
              { time: 0.25, rotation: 65 },
              { time: 0.5, rotation: -65 }
            ],
            scale: []
          }
        ]
      }
    ]
  };

  return withDefaultSkin(document);
}

export function createMeshSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createSampleDocument(images);
  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];
  const armAttachment = document.attachments.find((attachment) => attachment.name === 'arm');
  if (!armAttachment) {
    return document;
  }

  const meshAttachment: Suwol2DMeshAttachment = {
    name: 'arm_mesh',
    slot: 'arm_slot',
    type: 'mesh',
    image: armImage?.name ?? 'arm',
    x: 0.2,
    y: -0.25,
    rotation: -18,
    scaleX: 1,
    scaleY: 1,
    vertices: [
      { x: -0.13, y: -0.425, u: 0, v: 0 },
      { x: 0.13, y: -0.425, u: 1, v: 0 },
      { x: 0.16, y: 0.425, u: 1, v: 1 },
      { x: -0.1, y: 0.425, u: 0, v: 1 }
    ],
    triangles: [0, 1, 2, 0, 2, 3]
  };

  document.name = 'sample_mesh_character';
  document.attachments = document.attachments.filter((attachment) => attachment.name !== 'arm');
  document.attachments.push(meshAttachment);
  const armSlot = document.slots.find((slot) => slot.name === 'arm_slot');
  if (armSlot) {
    armSlot.attachment = meshAttachment.name;
  }

  return withDefaultSkin(document);
}

export function createWeightedMeshSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const bodyImage = images.find((image) => image.name === 'body') ?? images[0];
  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];

  const document: Suwol2DDocument = {
    version: 0,
    name: 'sample_weighted_character',
    bones: [
      { name: 'root', parent: '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'body', parent: 'root', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'upper_arm', parent: 'body', x: 0.42, y: 0.18, rotation: -12, scaleX: 1, scaleY: 1 },
      { name: 'lower_arm', parent: 'upper_arm', x: 0.3, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
    ],
    slots: [
      { name: 'body_slot', bone: 'body', attachment: 'body', drawOrder: 0 },
      { name: 'arm_slot', bone: 'upper_arm', attachment: 'arm_weighted_mesh', drawOrder: 1 }
    ],
    skins: [{ name: 'default', attachments: [] }],
    attachments: [
      {
        name: 'body',
        slot: 'body_slot',
        type: 'region',
        image: bodyImage?.name ?? 'body',
        x: 0,
        y: 0,
        rotation: 0,
        width: 0.9,
        height: 1.35,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'arm_weighted_mesh',
        slot: 'arm_slot',
        type: 'mesh',
        image: armImage?.name ?? 'arm',
        x: 0,
        y: -0.25,
        rotation: -18,
        scaleX: 1,
        scaleY: 1,
        vertices: [
          { x: -0.08, y: -0.11, u: 0, v: 0 },
          { x: 0.18, y: -0.09, u: 0.35, v: 0 },
          { x: 0.42, y: -0.075, u: 0.7, v: 0 },
          { x: 0.64, y: -0.055, u: 1, v: 0 },
          { x: 0.64, y: 0.055, u: 1, v: 1 },
          { x: 0.42, y: 0.075, u: 0.7, v: 1 },
          { x: 0.18, y: 0.09, u: 0.35, v: 1 },
          { x: -0.08, y: 0.11, u: 0, v: 1 }
        ],
        triangles: [0, 1, 6, 0, 6, 7, 1, 2, 5, 1, 5, 6, 2, 3, 4, 2, 4, 5],
        weights: [
          { vertex: 0, bones: [{ bone: 'upper_arm', weight: 1 }] },
          { vertex: 1, bones: [{ bone: 'upper_arm', weight: 0.8 }, { bone: 'lower_arm', weight: 0.2 }] },
          { vertex: 2, bones: [{ bone: 'upper_arm', weight: 0.5 }, { bone: 'lower_arm', weight: 0.5 }] },
          { vertex: 3, bones: [{ bone: 'lower_arm', weight: 1 }] },
          { vertex: 4, bones: [{ bone: 'lower_arm', weight: 1 }] },
          { vertex: 5, bones: [{ bone: 'upper_arm', weight: 0.5 }, { bone: 'lower_arm', weight: 0.5 }] },
          { vertex: 6, bones: [{ bone: 'upper_arm', weight: 0.8 }, { bone: 'lower_arm', weight: 0.2 }] },
          { vertex: 7, bones: [{ bone: 'upper_arm', weight: 1 }] }
        ]
      }
    ],
    animations: [
      {
        name: 'idle',
        loop: true,
        bones: [
          {
            bone: 'root',
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 0.5, x: 0, y: 0.12 },
              { time: 1, x: 0, y: 0 }
            ],
            rotate: [],
            scale: []
          },
          {
            bone: 'upper_arm',
            translate: [],
            rotate: [
              { time: 0, rotation: -16 },
              { time: 0.5, rotation: -4 },
              { time: 1, rotation: -16 }
            ],
            scale: []
          }
        ]
      },
      {
        name: 'walk',
        loop: true,
        bones: [
          {
            bone: 'upper_arm',
            translate: [],
            rotate: [
              { time: 0, rotation: -35 },
              { time: 0.25, rotation: 25 },
              { time: 0.5, rotation: -35 }
            ],
            scale: []
          },
          {
            bone: 'lower_arm',
            translate: [],
            rotate: [
              { time: 0, rotation: -45 },
              { time: 0.25, rotation: 50 },
              { time: 0.5, rotation: -45 }
            ],
            scale: []
          }
        ]
      }
    ]
  };

  return withDefaultSkin(document);
}

export function createDeformSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createWeightedMeshSampleDocument(images);
  const meshAttachment = document.attachments.find((attachment) => attachment.name === 'arm_weighted_mesh');
  const armSlot = document.slots.find((slot) => slot.name === 'arm_slot');
  if (!meshAttachment || meshAttachment.type !== 'mesh' || !armSlot) {
    return document;
  }

  document.name = 'sample_deform_character';
  meshAttachment.name = 'arm_deform_mesh';
  armSlot.attachment = meshAttachment.name;

  const idle = document.animations.find((animation) => animation.name === 'idle');
  if (idle) {
    idle.deforms = [
      {
        slot: 'arm_slot',
        attachment: meshAttachment.name,
        keys: [
          { time: 0, offsets: createZeroDeformOffsets(meshAttachment.vertices.length) },
          {
            time: 0.5,
            offsets: [
              { vertex: 1, x: 0, y: -0.025 },
              { vertex: 2, x: 0.025, y: -0.035 },
              { vertex: 3, x: 0.04, y: -0.02 },
              { vertex: 4, x: 0.04, y: 0.02 },
              { vertex: 5, x: 0.025, y: 0.035 },
              { vertex: 6, x: 0, y: 0.025 }
            ]
          },
          { time: 1, offsets: createZeroDeformOffsets(meshAttachment.vertices.length) }
        ]
      }
    ];
  }

  const walk = document.animations.find((animation) => animation.name === 'walk');
  if (walk) {
    walk.deforms = [
      {
        slot: 'arm_slot',
        attachment: meshAttachment.name,
        keys: [
          {
            time: 0,
            offsets: [
              { vertex: 1, x: -0.015, y: -0.035 },
              { vertex: 2, x: 0.035, y: -0.045 },
              { vertex: 3, x: 0.055, y: -0.02 },
              { vertex: 4, x: 0.025, y: 0.03 },
              { vertex: 5, x: -0.015, y: 0.04 },
              { vertex: 6, x: -0.025, y: 0.025 }
            ]
          },
          {
            time: 0.25,
            offsets: [
              { vertex: 1, x: 0.02, y: 0.03 },
              { vertex: 2, x: 0.01, y: 0.045 },
              { vertex: 3, x: -0.035, y: 0.035 },
              { vertex: 4, x: -0.055, y: -0.02 },
              { vertex: 5, x: -0.015, y: -0.04 },
              { vertex: 6, x: 0.025, y: -0.025 }
            ]
          },
          {
            time: 0.5,
            offsets: [
              { vertex: 1, x: -0.015, y: -0.035 },
              { vertex: 2, x: 0.035, y: -0.045 },
              { vertex: 3, x: 0.055, y: -0.02 },
              { vertex: 4, x: 0.025, y: 0.03 },
              { vertex: 5, x: -0.015, y: 0.04 },
              { vertex: 6, x: -0.025, y: 0.025 }
            ]
          }
        ]
      }
    ];
  }

  return withDefaultSkin(document);
}

export function createIkSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const bodyImage = images.find((image) => image.name === 'body') ?? images[0];
  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];

  const document: Suwol2DDocument = {
    version: 0,
    name: 'sample_ik_character',
    bones: [
      { name: 'root', parent: '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 1 },
      { name: 'body', parent: 'root', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 0.6 },
      { name: 'upper_arm', parent: 'body', x: 0.35, y: 0.2, rotation: -12, scaleX: 1, scaleY: 1, length: 0.34 },
      { name: 'lower_arm', parent: 'upper_arm', x: 0.34, y: 0, rotation: -18, scaleX: 1, scaleY: 1, length: 0.32 },
      { name: 'hand_target', parent: 'body', x: 0.82, y: 0.12, rotation: 0, scaleX: 1, scaleY: 1, length: 0.12 }
    ],
    slots: [
      { name: 'body_slot', bone: 'body', attachment: 'body', drawOrder: 0 },
      { name: 'arm_slot', bone: 'upper_arm', attachment: 'arm_ik_mesh', drawOrder: 1 }
    ],
    skins: [{ name: 'default', attachments: [] }],
    attachments: [
      {
        name: 'body',
        slot: 'body_slot',
        type: 'region',
        image: bodyImage?.name ?? 'body',
        x: 0,
        y: 0,
        rotation: 0,
        width: 0.9,
        height: 1.35,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'arm_ik_mesh',
        slot: 'arm_slot',
        type: 'mesh',
        image: armImage?.name ?? 'arm',
        x: 0,
        y: -0.08,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        vertices: [
          { x: -0.04, y: -0.08, u: 0, v: 0 },
          { x: 0.18, y: -0.075, u: 0.35, v: 0 },
          { x: 0.36, y: -0.065, u: 0.58, v: 0 },
          { x: 0.68, y: -0.055, u: 1, v: 0 },
          { x: 0.68, y: 0.055, u: 1, v: 1 },
          { x: 0.36, y: 0.065, u: 0.58, v: 1 },
          { x: 0.18, y: 0.075, u: 0.35, v: 1 },
          { x: -0.04, y: 0.08, u: 0, v: 1 }
        ],
        triangles: [0, 1, 6, 0, 6, 7, 1, 2, 5, 1, 5, 6, 2, 3, 4, 2, 4, 5],
        weights: [
          { vertex: 0, bones: [{ bone: 'upper_arm', weight: 1 }] },
          { vertex: 1, bones: [{ bone: 'upper_arm', weight: 0.85 }, { bone: 'lower_arm', weight: 0.15 }] },
          { vertex: 2, bones: [{ bone: 'upper_arm', weight: 0.45 }, { bone: 'lower_arm', weight: 0.55 }] },
          { vertex: 3, bones: [{ bone: 'lower_arm', weight: 1 }] },
          { vertex: 4, bones: [{ bone: 'lower_arm', weight: 1 }] },
          { vertex: 5, bones: [{ bone: 'upper_arm', weight: 0.45 }, { bone: 'lower_arm', weight: 0.55 }] },
          { vertex: 6, bones: [{ bone: 'upper_arm', weight: 0.85 }, { bone: 'lower_arm', weight: 0.15 }] },
          { vertex: 7, bones: [{ bone: 'upper_arm', weight: 1 }] }
        ]
      }
    ],
    animations: [
      {
        name: 'idle',
        loop: true,
        bones: [
          {
            bone: 'hand_target',
            translate: [
              { time: 0, x: 0.82, y: 0.12 },
              { time: 0.5, x: 0.74, y: 0.26 },
              { time: 1, x: 0.82, y: 0.12 }
            ],
            rotate: [],
            scale: []
          }
        ]
      },
      {
        name: 'walk',
        loop: true,
        bones: [
          {
            bone: 'hand_target',
            translate: [
              { time: 0, x: 0.82, y: 0.12 },
              { time: 0.25, x: 0.58, y: -0.18 },
              { time: 0.5, x: 0.82, y: 0.12 },
              { time: 0.75, x: 0.67, y: 0.34 },
              { time: 1, x: 0.82, y: 0.12 }
            ],
            rotate: [],
            scale: []
          }
        ]
      }
    ],
    ikConstraints: [
      {
        name: 'arm_ik',
        parentBone: 'upper_arm',
        childBone: 'lower_arm',
        targetBone: 'hand_target',
        enabled: true,
        mix: 1,
        bendDirection: 1,
        order: 0
      }
    ]
  };

  return withDefaultSkin(document);
}

export function createSkinSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createSampleDocument(images);
  const defaultSkin = document.skins.find((skin) => skin.name === 'default') ?? {
    name: 'default',
    attachments: cloneAttachments(document.attachments)
  };
  const body = defaultSkin.attachments.find((attachment) => attachment.name === 'body');
  const arm = defaultSkin.attachments.find((attachment) => attachment.name === 'arm');
  const bodyBase = body ?? document.attachments[0];
  const armBase = arm ?? document.attachments[1] ?? bodyBase;
  const bodyArmorImage = images.find((image) => image.name === 'body_armor') ?? images.find((image) => image.name === 'body') ?? images[0];
  const armArmorImage = images.find((image) => image.name === 'arm_armor') ?? images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];
  if (!bodyBase || !armBase || bodyBase.type === 'clipping' || armBase.type === 'clipping') {
    return document;
  }

  document.name = 'sample_skin_character';
  document.skins = [
    defaultSkin,
    {
      name: 'armor_01',
      attachments: [
        {
          ...cloneAttachment(bodyBase),
          name: 'body_armor',
          slot: 'body_slot',
          image: bodyArmorImage?.name ?? 'body_armor',
          scaleX: 1.06,
          scaleY: 1.04
        },
        {
          ...cloneAttachment(armBase),
          name: 'arm_armor',
          slot: 'arm_slot',
          image: armArmorImage?.name ?? 'arm_armor',
          scaleX: 1.12,
          scaleY: 1.05
        }
      ]
    }
  ];
  syncTopLevelAttachmentsFromSkins(document);
  return document;
}

export function createAnimationTimelinesSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const bodyImage = images.find((image) => image.name === 'body') ?? images[0];
  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];
  const swordImage = images.find((image) => image.name === 'sword') ?? images.find((image) => image.name === 'arm') ?? images[2] ?? images[0];
  const axeImage = images.find((image) => image.name === 'axe') ?? images.find((image) => image.name === 'arm') ?? images[3] ?? images[0];

  const document: Suwol2DDocument = {
    version: 0,
    name: 'sample_animation_timelines',
    bones: [
      { name: 'root', parent: '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'body', parent: 'root', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'arm', parent: 'body', x: 0.42, y: 0.24, rotation: -8, scaleX: 1, scaleY: 1 },
      { name: 'weapon', parent: 'arm', x: 0.36, y: -0.18, rotation: -18, scaleX: 1, scaleY: 1 }
    ],
    slots: [
      { name: 'body_slot', bone: 'body', attachment: 'body', drawOrder: 0 },
      { name: 'arm_slot', bone: 'arm', attachment: 'arm', drawOrder: 1 },
      { name: 'weapon_slot', bone: 'weapon', attachment: 'sword', drawOrder: 2 }
    ],
    skins: [{ name: 'default', attachments: [] }],
    attachments: [
      {
        name: 'body',
        slot: 'body_slot',
        type: 'region',
        image: bodyImage?.name ?? 'body',
        x: 0,
        y: 0,
        rotation: 0,
        width: 0.9,
        height: 1.35,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'arm',
        slot: 'arm_slot',
        type: 'region',
        image: armImage?.name ?? 'arm',
        x: 0.18,
        y: -0.24,
        rotation: -18,
        width: 0.26,
        height: 0.85,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'sword',
        slot: 'weapon_slot',
        type: 'region',
        image: swordImage?.name ?? 'sword',
        x: 0.28,
        y: -0.02,
        rotation: -12,
        width: 0.18,
        height: 0.95,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'axe',
        slot: 'weapon_slot',
        type: 'region',
        image: axeImage?.name ?? 'axe',
        x: 0.24,
        y: 0,
        rotation: 8,
        width: 0.34,
        height: 0.82,
        scaleX: 1,
        scaleY: 1
      }
    ],
    animations: [
      {
        name: 'walk',
        loop: true,
        bones: [
          {
            bone: 'root',
            translate: [
              { time: 0, x: -0.08, y: 0 },
              { time: 0.25, x: 0.08, y: 0.08 },
              { time: 0.5, x: -0.08, y: 0 }
            ],
            rotate: [],
            scale: []
          },
          {
            bone: 'arm',
            translate: [],
            rotate: [
              { time: 0, rotation: -42 },
              { time: 0.25, rotation: 34 },
              { time: 0.5, rotation: -42 }
            ],
            scale: []
          }
        ],
        attachments: [
          {
            slot: 'weapon_slot',
            keys: [
              { time: 0, attachment: 'sword' },
              { time: 0.25, attachment: 'axe' },
              { time: 0.45, attachment: null }
            ]
          }
        ],
        drawOrders: [
          {
            time: 0,
            slots: [
              { slot: 'body_slot', drawOrder: 0 },
              { slot: 'arm_slot', drawOrder: 1 },
              { slot: 'weapon_slot', drawOrder: 2 }
            ]
          },
          {
            time: 0.25,
            slots: [
              { slot: 'body_slot', drawOrder: 0 },
              { slot: 'weapon_slot', drawOrder: 1 },
              { slot: 'arm_slot', drawOrder: 2 }
            ]
          }
        ],
        slots: [
          {
            slot: 'body_slot',
            color: [
              { time: 0, r: 1, g: 1, b: 1, a: 1 },
              { time: 0.25, r: 1, g: 0.72, b: 0.72, a: 0.78 },
              { time: 0.5, r: 1, g: 1, b: 1, a: 1 }
            ]
          }
        ],
        events: [
          { time: 0.1, name: 'footstep', intValue: 0, floatValue: 1, stringValue: 'left' },
          { time: 0.35, name: 'footstep', intValue: 1, floatValue: 1, stringValue: 'right' }
        ]
      },
      {
        name: 'attack',
        loop: false,
        bones: [
          {
            bone: 'arm',
            translate: [],
            rotate: [
              { time: 0, rotation: -70 },
              { time: 0.18, rotation: 65 },
              { time: 0.42, rotation: -24 }
            ],
            scale: []
          }
        ],
        attachments: [
          {
            slot: 'weapon_slot',
            keys: [
              { time: 0, attachment: 'sword' },
              { time: 0.2, attachment: 'axe' },
              { time: 0.42, attachment: 'sword' }
            ]
          }
        ],
        drawOrders: [
          {
            time: 0,
            slots: [
              { slot: 'body_slot', drawOrder: 0 },
              { slot: 'arm_slot', drawOrder: 1 },
              { slot: 'weapon_slot', drawOrder: 2 }
            ]
          }
        ],
        slots: [
          {
            slot: 'weapon_slot',
            color: [
              { time: 0, r: 1, g: 1, b: 1, a: 1 },
              { time: 0.2, r: 1, g: 0.55, b: 0.35, a: 0.68 },
              { time: 0.42, r: 1, g: 1, b: 1, a: 1 }
            ]
          }
        ],
        events: [
          { time: 0.2, name: 'attack', intValue: 1, floatValue: 0, stringValue: 'slash' }
        ]
      }
    ]
  };

  return withDefaultSkin(document);
}

export function createAnimationMixingStateMachineSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createAnimationTimelinesSampleDocument(images);
  document.name = 'sample_animation_mixing_state_machine';

  document.animations.unshift({
    name: 'idle',
    loop: true,
    bones: [
      {
        bone: 'root',
        translate: [
          { time: 0, x: 0, y: 0 },
          { time: 0.5, x: 0, y: 0.08 },
          { time: 1, x: 0, y: 0 }
        ],
        rotate: [],
        scale: []
      },
      {
        bone: 'body',
        translate: [],
        rotate: [
          { time: 0, rotation: -3 },
          { time: 0.5, rotation: 3 },
          { time: 1, rotation: -3 }
        ],
        scale: []
      },
      {
        bone: 'arm',
        translate: [],
        rotate: [
          { time: 0, rotation: -14 },
          { time: 0.5, rotation: -4 },
          { time: 1, rotation: -14 }
        ],
        scale: []
      }
    ],
    slots: [
      {
        slot: 'body_slot',
        color: [
          { time: 0, r: 1, g: 1, b: 1, a: 1 },
          { time: 0.5, r: 0.88, g: 1, b: 0.96, a: 1 },
          { time: 1, r: 1, g: 1, b: 1, a: 1 }
        ]
      }
    ],
    events: [
      { time: 0.5, name: 'idle_breathe', intValue: 0, floatValue: 0, stringValue: 'idle' }
    ]
  });

  document.stateMachines = [
    {
      name: 'default',
      initialState: 'idle',
      states: [
        { name: 'idle', animation: 'idle', loop: true, speed: 1 },
        { name: 'walk', animation: 'walk', loop: true, speed: 1 },
        { name: 'attack', animation: 'attack', loop: false, speed: 1 }
      ],
      parameters: [
        { name: 'moving', type: 'bool', defaultBool: false },
        { name: 'attack', type: 'trigger' }
      ],
      transitions: [
        {
          from: 'idle',
          to: 'walk',
          fadeDuration: 0.15,
          conditions: [{ parameter: 'moving', mode: 'equals', boolValue: true }]
        },
        {
          from: 'walk',
          to: 'idle',
          fadeDuration: 0.15,
          conditions: [{ parameter: 'moving', mode: 'equals', boolValue: false }]
        },
        {
          from: '*',
          to: 'attack',
          fadeDuration: 0.05,
          conditions: [{ parameter: 'attack', mode: 'triggered' }]
        }
      ]
    }
  ];

  return document;
}

export function createTimelineUsabilitySampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createAnimationTimelinesSampleDocument(images);
  document.name = 'sample_timeline_editing';
  document.stateMachines = undefined;

  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];
  const armRegion = document.attachments.find((attachment) => attachment.name === 'arm');
  if (armRegion && armRegion.type !== 'clipping') {
    const armMesh: Suwol2DMeshAttachment = {
      name: 'arm_timeline_mesh',
      slot: 'arm_slot',
      type: 'mesh',
      image: armImage?.name ?? armRegion.image,
      x: armRegion.x,
      y: armRegion.y,
      rotation: armRegion.rotation,
      scaleX: armRegion.scaleX,
      scaleY: armRegion.scaleY,
      vertices: [
        { x: -0.13, y: -0.425, u: 0, v: 0 },
        { x: 0.13, y: -0.425, u: 1, v: 0 },
        { x: 0.16, y: 0.425, u: 1, v: 1 },
        { x: -0.1, y: 0.425, u: 0, v: 1 }
      ],
      triangles: [0, 1, 2, 0, 2, 3]
    };
    document.attachments = document.attachments.filter((attachment) => attachment.name !== 'arm');
    document.attachments.push(armMesh);
    const armSlot = document.slots.find((slot) => slot.name === 'arm_slot');
    if (armSlot) {
      armSlot.attachment = armMesh.name;
    }
  }

  const walk = document.animations.find((animation) => animation.name === 'walk');
  if (walk) {
    walk.duration = 1.2;
    const root = walk.bones.find((timeline) => timeline.bone === 'root');
    if (root) {
      root.translate = [
        { time: 0, x: -0.08, y: 0 },
        { time: 0.3, x: 0.08, y: 0.08 },
        { time: 0.6, x: -0.08, y: 0 },
        { time: 0.9, x: 0.08, y: 0.08 },
        { time: 1.2, x: -0.08, y: 0 }
      ];
      root.scale = [
        { time: 0, scaleX: 1, scaleY: 1 },
        { time: 0.6, scaleX: 1.04, scaleY: 0.98 },
        { time: 1.2, scaleX: 1, scaleY: 1 }
      ];
    }
    const arm = walk.bones.find((timeline) => timeline.bone === 'arm');
    if (arm) {
      arm.rotate = [
        { time: 0, rotation: -42 },
        { time: 0.3, rotation: 34 },
        { time: 0.6, rotation: -42 },
        { time: 0.9, rotation: 34 },
        { time: 1.2, rotation: -42 }
      ];
    }
    walk.attachments = [
      {
        slot: 'weapon_slot',
        keys: [
          { time: 0, attachment: 'sword' },
          { time: 0.3, attachment: 'axe' },
          { time: 0.6, attachment: null },
          { time: 0.9, attachment: 'sword' }
        ]
      }
    ];
    walk.drawOrders = [
      {
        time: 0,
        slots: [
          { slot: 'body_slot', drawOrder: 0 },
          { slot: 'arm_slot', drawOrder: 1 },
          { slot: 'weapon_slot', drawOrder: 2 }
        ]
      },
      {
        time: 0.6,
        slots: [
          { slot: 'body_slot', drawOrder: 0 },
          { slot: 'weapon_slot', drawOrder: 1 },
          { slot: 'arm_slot', drawOrder: 2 }
        ]
      },
      {
        time: 1.2,
        slots: [
          { slot: 'body_slot', drawOrder: 0 },
          { slot: 'arm_slot', drawOrder: 1 },
          { slot: 'weapon_slot', drawOrder: 2 }
        ]
      }
    ];
    walk.slots = [
      {
        slot: 'body_slot',
        color: [
          { time: 0, r: 1, g: 1, b: 1, a: 1 },
          { time: 0.6, r: 1, g: 0.72, b: 0.72, a: 0.78 },
          { time: 1.2, r: 1, g: 1, b: 1, a: 1 }
        ]
      }
    ];
    walk.events = [
      { time: 0.1, name: 'footstep', intValue: 0, floatValue: 1, stringValue: 'left' },
      { time: 0.7, name: 'footstep', intValue: 1, floatValue: 1, stringValue: 'right' },
      { time: 1.05, name: 'loop_marker', intValue: 0, floatValue: 1.2, stringValue: 'walk' }
    ];
    walk.deforms = [
      {
        slot: 'arm_slot',
        attachment: 'arm_timeline_mesh',
        keys: [
          { time: 0, offsets: createZeroDeformOffsets(4) },
          {
            time: 0.6,
            offsets: [
              { vertex: 0, x: 0, y: 0 },
              { vertex: 1, x: 0, y: 0 },
              { vertex: 2, x: 0.06, y: 0.08 },
              { vertex: 3, x: -0.04, y: 0.05 }
            ]
          },
          { time: 1.2, offsets: createZeroDeformOffsets(4) }
        ]
      }
    ];
  }

  const attack = document.animations.find((animation) => animation.name === 'attack');
  if (attack) {
    attack.duration = 0.8;
    attack.events = [
      { time: 0.2, name: 'attack', intValue: 1, floatValue: 0, stringValue: 'slash' },
      { time: 0.6, name: 'recover', intValue: 0, floatValue: 0.8, stringValue: 'end' }
    ];
  }

  return withDefaultSkin(document);
}

export function createInterpolationSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createTimelineUsabilitySampleDocument(images);
  document.name = 'sample_curve_interpolation';

  document.animations = document.animations.filter((animation) => animation.name === 'walk');
  const walk = document.animations[0];
  if (walk) {
    walk.duration = 1.2;
  }

  document.animations.unshift({
    name: 'idle',
    loop: true,
    duration: 1,
    bones: [
      {
        bone: 'root',
        translate: [
          { time: 0, x: 0, y: 0, interpolation: 'linear' },
          { time: 0.5, x: 0, y: 0.08, interpolation: 'easeInOut' },
          { time: 1, x: 0, y: 0, interpolation: 'linear' }
        ],
        rotate: [],
        scale: []
      }
    ],
    slots: [
      {
        slot: 'body_slot',
        color: [
          { time: 0, r: 1, g: 1, b: 1, a: 1, interpolation: 'easeOut' },
          { time: 0.5, r: 0.85, g: 1, b: 0.95, a: 1, interpolation: 'linear' },
          { time: 1, r: 1, g: 1, b: 1, a: 1, interpolation: 'linear' }
        ]
      }
    ]
  });

  document.animations.push({
    name: 'curve_test',
    loop: true,
    duration: 1,
    bones: [
      {
        bone: 'root',
        translate: [
          { time: 0, x: -0.24, y: 0, interpolation: 'linear' },
          { time: 0.25, x: -0.08, y: 0.18, interpolation: 'easeIn' },
          { time: 0.5, x: 0.08, y: -0.02, interpolation: 'easeOut' },
          { time: 0.75, x: 0.24, y: 0.18, interpolation: 'easeInOut' },
          { time: 1, x: -0.24, y: 0, interpolation: 'linear' }
        ],
        rotate: [],
        scale: [
          { time: 0, scaleX: 1, scaleY: 1, interpolation: 'linear' },
          { time: 0.5, scaleX: 1.08, scaleY: 0.94, interpolation: 'easeOut' },
          { time: 1, scaleX: 1, scaleY: 1, interpolation: 'linear' }
        ]
      },
      {
        bone: 'arm',
        translate: [],
        rotate: [
          { time: 0, rotation: -48, interpolation: 'stepped' },
          { time: 0.35, rotation: 48, interpolation: 'easeInOut' },
          { time: 0.7, rotation: -28, interpolation: 'linear' },
          { time: 1, rotation: -48, interpolation: 'linear' }
        ],
        scale: []
      }
    ],
    slots: [
      {
        slot: 'body_slot',
        color: [
          { time: 0, r: 1, g: 1, b: 1, a: 1, interpolation: 'easeOut' },
          { time: 0.5, r: 0.55, g: 0.92, b: 1, a: 0.72, interpolation: 'linear' },
          { time: 1, r: 1, g: 1, b: 1, a: 1, interpolation: 'linear' }
        ]
      }
    ],
    deforms: [
      {
        slot: 'arm_slot',
        attachment: 'arm_timeline_mesh',
        keys: [
          { time: 0, offsets: createZeroDeformOffsets(4), interpolation: 'easeInOut' },
          {
            time: 0.5,
            offsets: [
              { vertex: 0, x: -0.02, y: -0.03 },
              { vertex: 1, x: 0.02, y: -0.03 },
              { vertex: 2, x: 0.08, y: 0.09 },
              { vertex: 3, x: -0.07, y: 0.07 }
            ],
            interpolation: 'linear'
          },
          { time: 1, offsets: createZeroDeformOffsets(4), interpolation: 'linear' }
        ]
      }
    ]
  });

  return withDefaultSkin(document);
}

export function createClippingSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const document = createTimelineUsabilitySampleDocument(images);
  document.name = 'sample_clipping_mask';

  if (!document.slots.some((slot) => slot.name === 'mask_slot')) {
    document.slots.unshift({
      name: 'mask_slot',
      bone: 'body',
      attachment: 'body_mask',
      drawOrder: 0
    });
  }
  document.slots.forEach((slot) => {
    if (slot.name === 'mask_slot') {
      slot.drawOrder = 0;
    } else {
      slot.drawOrder += 1;
    }
  });

  const clippingAttachment: Suwol2DClippingAttachment = {
    name: 'body_mask',
    slot: 'mask_slot',
    type: 'clipping',
    endSlot: 'arm_slot',
    x: 0,
    y: 0.05,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    clippingVertices: [
      { x: -0.42, y: -0.58 },
      { x: 0.3, y: -0.48 },
      { x: 0.38, y: 0.46 },
      { x: -0.34, y: 0.62 }
    ]
  };

  document.attachments = document.attachments.filter((attachment) => attachment.name !== clippingAttachment.name);
  document.attachments.unshift(clippingAttachment);

  for (const animation of document.animations) {
    animation.attachments ??= [];
    const maskTimeline = animation.attachments.find((timeline) => timeline.slot === 'mask_slot');
    const keys = animation.name === 'walk'
      ? [
        { time: 0, attachment: 'body_mask' },
        { time: 0.6, attachment: null },
        { time: 0.9, attachment: 'body_mask' }
      ]
      : [
        { time: 0, attachment: 'body_mask' }
      ];
    if (maskTimeline) {
      maskTimeline.keys = keys;
    } else {
      animation.attachments.unshift({ slot: 'mask_slot', keys });
    }

    for (const drawOrder of animation.drawOrders ?? []) {
      if (!drawOrder.slots.some((slot) => slot.slot === 'mask_slot')) {
        drawOrder.slots.unshift({ slot: 'mask_slot', drawOrder: 0 });
      }
      drawOrder.slots = drawOrder.slots
        .map((slot) => slot.slot === 'mask_slot' ? slot : { ...slot, drawOrder: slot.drawOrder + 1 })
        .sort((a, b) => a.drawOrder - b.drawOrder || a.slot.localeCompare(b.slot));
    }
  }

  return withDefaultSkin(document);
}

export function createTransformConstraintSampleDocument(images: ImportedImage[]): Suwol2DDocument {
  const bodyImage = images.find((image) => image.name === 'body') ?? images[0];
  const armImage = images.find((image) => image.name === 'arm') ?? images[1] ?? images[0];
  const swordImage = images.find((image) => image.name === 'sword') ?? images[2] ?? images[0];
  const weaponFollowHand: Suwol2DTransformConstraint = {
    name: 'weapon_follow_hand',
    bone: 'weapon',
    targetBone: 'hand',
    enabled: true,
    order: 0,
    translateMix: 1,
    rotateMix: 1,
    scaleMix: 0,
    offsetX: 0,
    offsetY: 0,
    offsetRotation: 0,
    offsetScaleX: 0,
    offsetScaleY: 0
  };

  const document: Suwol2DDocument = {
    version: 0,
    name: 'sample_transform_constraint',
    bones: [
      { name: 'root', parent: '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'body', parent: 'root', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: 'hand', parent: 'body', x: 0.42, y: 0.24, rotation: -18, scaleX: 1, scaleY: 1 },
      { name: 'weapon', parent: 'body', x: -0.24, y: -0.22, rotation: -60, scaleX: 1, scaleY: 1 }
    ],
    slots: [
      { name: 'body_slot', bone: 'body', attachment: 'body', drawOrder: 0 },
      { name: 'hand_slot', bone: 'hand', attachment: 'hand', drawOrder: 1 },
      { name: 'weapon_slot', bone: 'weapon', attachment: 'weapon', drawOrder: 2 }
    ],
    skins: [{ name: 'default', attachments: [] }],
    attachments: [
      {
        name: 'body',
        slot: 'body_slot',
        type: 'region',
        image: bodyImage?.name ?? 'body',
        x: 0,
        y: 0,
        rotation: 0,
        width: 0.9,
        height: 1.35,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'hand',
        slot: 'hand_slot',
        type: 'region',
        image: armImage?.name ?? 'arm',
        x: 0.18,
        y: -0.24,
        rotation: -18,
        width: 0.26,
        height: 0.85,
        scaleX: 1,
        scaleY: 1
      },
      {
        name: 'weapon',
        slot: 'weapon_slot',
        type: 'region',
        image: swordImage?.name ?? 'sword',
        x: 0.28,
        y: -0.02,
        rotation: -12,
        width: 0.18,
        height: 0.95,
        scaleX: 1,
        scaleY: 1
      }
    ],
    transformConstraints: [weaponFollowHand],
    animations: [
      {
        name: 'swing',
        loop: true,
        duration: 1,
        bones: [
          {
            bone: 'root',
            translate: [
              { time: 0, x: 0, y: 0, interpolation: 'easeInOut' },
              { time: 0.5, x: 0, y: 0.08, interpolation: 'easeOut' },
              { time: 1, x: 0, y: 0, interpolation: 'easeInOut' }
            ],
            rotate: [],
            scale: []
          },
          {
            bone: 'body',
            translate: [],
            rotate: [
              { time: 0, rotation: -4, interpolation: 'easeInOut' },
              { time: 0.5, rotation: 4, interpolation: 'easeInOut' },
              { time: 1, rotation: -4, interpolation: 'easeInOut' }
            ],
            scale: []
          },
          {
            bone: 'hand',
            translate: [
              { time: 0, x: 0.42, y: 0.24, interpolation: 'easeInOut' },
              { time: 0.5, x: 0.62, y: 0.36, interpolation: 'easeOut' },
              { time: 1, x: 0.42, y: 0.24, interpolation: 'easeInOut' }
            ],
            rotate: [
              { time: 0, rotation: -64, interpolation: 'easeInOut' },
              { time: 0.5, rotation: 48, interpolation: 'easeOut' },
              { time: 1, rotation: -64, interpolation: 'easeInOut' }
            ],
            scale: []
          }
        ],
        slots: [
          {
            slot: 'weapon_slot',
            color: [
              { time: 0, r: 1, g: 1, b: 1, a: 1, interpolation: 'linear' },
              { time: 0.5, r: 0.85, g: 1, b: 1, a: 1, interpolation: 'easeOut' },
              { time: 1, r: 1, g: 1, b: 1, a: 1, interpolation: 'linear' }
            ]
          }
        ]
      }
    ]
  };

  return withDefaultSkin(document);
}

function createZeroDeformOffsets(vertexCount: number): Suwol2DVertexOffset[] {
  return Array.from({ length: vertexCount }, (_, vertex) => ({ vertex, x: 0, y: 0 }));
}

function withDefaultSkin(document: Suwol2DDocument): Suwol2DDocument {
  document.skins = [{ name: 'default', attachments: cloneAttachments(document.attachments) }];
  return document;
}
