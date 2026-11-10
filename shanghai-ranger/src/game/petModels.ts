import * as THREE from 'three';
import { ellipsoid, taperedTube, batchRigidParts } from './materials';

const mat = (color: string, roughness = .94) => new THREE.MeshStandardMaterial({ color, roughness });
const point = (x: number, y: number, z: number) => new THREE.Vector3(x,y,z);
function solid(parent: THREE.Group, material: THREE.Material, points: number[], indices: number[], name: string) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry,material); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function leg(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, radius: number, length: number) {
  const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,3,7),material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);
}

/** A low, long, broad-chested corgi. Its body is independent of the shiba construction below. */
export function createCorgiAnatomy() {
  const root=new THREE.Group();root.name='anatomy-corgi';
  const fur=mat('#d6a15f'),white=mat('#f1e6d0'),sable=mat('#ad7543'),pink=mat('#cd9f8a'),eye=mat('#242328',.24),glint=new THREE.MeshBasicMaterial({color:'#fff0d7'});
  pink.side=THREE.DoubleSide;
  ellipsoid(root,fur,[0,.285,-.055],[.195,.165,.365]);
  ellipsoid(root,fur,[0,.29,.18],[.205,.185,.22]);
  ellipsoid(root,fur,[0,.275,-.28],[.205,.18,.18]);
  ellipsoid(root,white,[0,.245,.24],[.15,.14,.15]);
  ellipsoid(root,white,[0,.17,-.015],[.14,.075,.26]);
  for(const side of [-1,1]) {
    ellipsoid(root,fur,[side*.145,.19,-.25],[.075,.105,.105]);
    for(const z of [-.24,.20]) { leg(root,fur,side*.13,.125,z,.046,.095);ellipsoid(root,white,[side*.13,.045,z+.025],[.058,.044,.077]); }
  }
  // Broad rounded skull, white blaze and a substantial blunt muzzle.
  ellipsoid(root,fur,[0,.455,.325],[.15,.132,.145]);
  ellipsoid(root,white,[0,.402,.445],[.112,.077,.105]);
  ellipsoid(root,white,[0,.485,.435],[.034,.10,.04]);
  ellipsoid(root,eye,[0,.425,.54],[.032,.022,.019]);
  for(const side of [-1,1]) {
    ellipsoid(root,sable,[side*.095,.49,.419],[.035,.026,.012]);
    ellipsoid(root,eye,[side*.075,.48,.439],[.022,.023,.012]);
    ellipsoid(root,glint,[side*.069,.487,.45],[.006,.007,.005]);
    solid(root,fur,[side*.04,.535,.30,side*.16,.53,.31,side*.145,.715,.285,side*.095,.535,.25],[0,1,2,0,2,3,1,3,2,0,3,1],'corgi-large-ear');
    solid(root,pink,[side*.072,.554,.309,side*.137,.55,.315,side*.136,.681,.295],[0,1,2],'corgi-inner-ear');
  }
  ellipsoid(root,fur,[0,.34,-.405],[.068,.07,.07]);ellipsoid(root,white,[0,.365,-.439],[.045,.044,.044]);
  batchRigidParts(root);return root;
}

/** A compact, tall-legged shiba with a fox-shaped head and a thick curl over its back. */
export function createShibaAnatomy() {
  const root=new THREE.Group();root.name='anatomy-shiba';
  const fur=mat('#bb6737'),warm=mat('#d58c4b'),white=mat('#eee3ca'),dark=mat('#46342d'),eye=mat('#202026',.25),glint=new THREE.MeshBasicMaterial({color:'#fff0d7'}),pink=mat('#c88b75');
  pink.side=THREE.DoubleSide;
  ellipsoid(root,fur,[0,.475,-.025],[.155,.175,.275]);
  ellipsoid(root,fur,[0,.49,.16],[.165,.205,.18]);
  ellipsoid(root,warm,[0,.48,-.22],[.165,.18,.15]);
  ellipsoid(root,white,[0,.455,.27],[.104,.185,.085]);
  ellipsoid(root,white,[0,.35,.025],[.104,.07,.19]);
  ellipsoid(root,fur,[0,.61,.235],[.105,.145,.10]);
  for(const side of [-1,1]) {
    // Long forelegs and a bent hock distinguish the stance even without colour.
    leg(root,fur,side*.105,.27,.17,.034,.27);
    root.add(taperedTube([point(side*.12,.47,-.20),point(side*.13,.29,-.25),point(side*.12,.10,-.19)],[.068,.043,.028],fur,7,10));
    for(const z of [.17,-.19]) { leg(root,white,side*.108,.09,z,.032,.065);ellipsoid(root,white,[side*.108,.041,z+.025],[.044,.036,.061]); }
  }
  ellipsoid(root,fur,[0,.685,.275],[.12,.12,.125]);
  // A tapered wedge, rather than the corgi's round white muzzle.
  solid(root,warm,[-.082,.69,.33,.082,.69,.33,-.036,.65,.505,.036,.65,.505,-.073,.615,.335,.073,.615,.335,-.032,.615,.492,.032,.615,.492],
    [0,2,1,1,2,3,0,4,2,2,4,6,1,3,5,3,7,5,4,5,6,5,7,6,2,6,3,3,6,7],'shiba-wedge-muzzle');
  ellipsoid(root,white,[0,.616,.41],[.066,.038,.084]);
  for(const side of [-1,1]) {
    const cheek=ellipsoid(root,white,[side*.071,.641,.365],[.057,.043,.061]);cheek.rotation.z=side*.22;
    ellipsoid(root,warm,[side*.102,.662,.302],[.033,.052,.062]);
    const e=ellipsoid(root,eye,[side*.067,.714,.386],[.022,.017,.012]);e.rotation.z=side*-.22;
    ellipsoid(root,glint,[side*.061,.719,.398],[.0045,.0045,.004]);
    ellipsoid(root,white,[side*.071,.746,.355],[.018,.008,.012]);
    solid(root,fur,[side*.04,.768,.25,side*.119,.761,.245,side*.10,.887,.225,side*.083,.76,.19],[0,1,2,0,2,3,1,3,2,0,3,1],'shiba-thick-triangular-ear');
    solid(root,pink,[side*.058,.783,.252,side*.105,.778,.248,side*.095,.858,.233],[0,1,2],'shiba-inner-ear');
  }
  ellipsoid(root,eye,[0,.65,.508],[.028,.018,.018]);
  ellipsoid(root,dark,[0,.605,.47],[.025,.005,.014]);
  root.add(taperedTube([point(0,.54,-.25),point(0,.69,-.34),point(.025,.80,-.28),point(.055,.80,-.15),point(.06,.70,-.12),point(.055,.66,-.21)],[.047,.057,.056,.05,.043,.03],fur,8,20));
  ellipsoid(root,white,[.055,.66,-.21],[.034,.037,.036]);
  batchRigidParts(root);return root;
}
