"""Clean colour render of a GLB on a transparent background (Cycles CPU, orthographic).

Usage:
  python3 -I render_view.py OUT_PREFIX model.glb --view thin|yaw:<deg> [--elev 0.2] [--frames a-b:step] [--res 768] [--toon]

--view thin      camera looks along the model's thinnest bounding-box axis (weapons lying flat)
--view yaw:<deg> camera orbits around Z; 0 = camera at -Y looking +Y
--frames         render an animation frame range (first action), fixed framing over all frames
Writes OUT_PREFIX_<frame>.png (or OUT_PREFIX.png for a single still).
"""
import sys, math, argparse
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("glb")
ap.add_argument("--view", default="yaw:0"); ap.add_argument("--elev", type=float, default=0.15)
ap.add_argument("--frames", default=""); ap.add_argument("--res", type=int, default=768)
ap.add_argument("--samples", type=int, default=48); ap.add_argument("--ambient", type=float, default=0.9)
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples
sc.cycles.use_denoising = False
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = a.res
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = a.ambient
sc.world = w
bpy.ops.import_scene.gltf(filepath=a.glb)

# Matte look: kill specular/metal sheen a bit so it reads like painted art.
for m in bpy.data.materials:
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                if "Roughness" in n.inputs and not n.inputs["Roughness"].links:
                    n.inputs["Roughness"].default_value = max(0.6, n.inputs["Roughness"].default_value)
                if "Specular IOR Level" in n.inputs:
                    n.inputs["Specular IOR Level"].default_value = 0.25

frames = [1]
if a.frames:
    rng, step = (a.frames.split(":") + ["1"])[:2]
    lo_f, hi_f = map(int, rng.split("-"))
    frames = list(range(lo_f, hi_f + 1, int(step)))


def mesh_bounds():
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in sc.objects:
        if o.type != "MESH" or o.hide_render:
            continue
        oe = o.evaluated_get(dg); me = oe.to_mesh()
        mw = oe.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
        oe.to_mesh_clear()
    return lo, hi

lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for fr in frames:
    sc.frame_set(fr)
    l, h = mesh_bounds()
    lo = Vector(map(min, lo, l)); hi = Vector(map(max, hi, h))
ctr = (lo + hi) / 2; ext = hi - lo

if a.view == "thin":
    ax = min(range(3), key=lambda i: ext[i])
    d = Vector((0, 0, 0)); d[ax] = 1.0
    if ax == 2:
        up = "Y"
    else:
        up = "Z"
    span = max(e for i, e in enumerate(ext) if i != ax)
    # a tiny tilt so the item doesn't look perfectly flat
    d = (d + Vector((0.12, -0.12, 0.12))).normalized()
else:
    yaw = math.radians(float(a.view.split(":")[1]))
    d = Vector((math.sin(yaw), -math.cos(yaw), a.elev)).normalized()
    up = "Y"
    span = max(ext)

cam_d = bpy.data.cameras.new("c"); cam_d.type = "ORTHO"; cam_d.ortho_scale = span * 1.08
cam = bpy.data.objects.new("c", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = ctr + d * max(ext) * 4
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_d.clip_end = max(ext) * 20

key = bpy.data.lights.new("k", "SUN"); key.energy = 2.2; key.angle = math.radians(20)
ko = bpy.data.objects.new("k", key); sc.collection.objects.link(ko)
ko.rotation_euler = (cam.rotation_euler.to_matrix() @ Vector((0, 0, 1))).to_track_quat("Z", "Y").to_euler()
ko.rotation_euler.x -= math.radians(35); ko.rotation_euler.z += math.radians(30)

for fr in frames:
    sc.frame_set(fr)
    sc.render.filepath = f"{a.out}_{fr:03d}.png" if a.frames else f"{a.out}.png"
    bpy.ops.render.render(write_still=True)
print("RENDERED", len(frames), "frames; actions:", [x.name for x in bpy.data.actions],
      "range:", [tuple(x.frame_range) for x in bpy.data.actions])
