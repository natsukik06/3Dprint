"""
Blender headless script: hollow an STL with a Solidify shell and cut a
cylindrical drain hole through the bottom, then export the result as STL.

Run via Blender's own Python (not a system Python install):

    blender.exe --background --python hollow_and_hole.py -- ^
        --input "in.stl" --output "out.stl" ^
        --wall-thickness 2.0 --hole-diameter 3.0

Everything after the lone `--` is passed through to this script's argv;
Blender's own CLI args are stripped before that point.
"""

import argparse
import os
import sys

import bpy


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to the source STL")
    parser.add_argument("--output", required=True, help="Path to write the hollowed STL")
    parser.add_argument(
        "--wall-thickness", type=float, default=2.0, help="Shell wall thickness in mm"
    )
    parser.add_argument(
        "--hole-diameter", type=float, default=3.0, help="Drain hole diameter in mm"
    )
    parser.add_argument(
        "--hole-x",
        type=float,
        default=0.5,
        help=(
            "Where the drain hole sits along the model's X footprint, as a "
            "0-1 fraction (0 = min-X edge, 0.5 = center, 1 = max-X edge). "
            "The hole is always on the bottom face; only its X/Y position "
            "on that face is adjustable. Default 0.5 = centered."
        ),
    )
    parser.add_argument(
        "--hole-y",
        type=float,
        default=0.5,
        help="Same as --hole-x but for the Y footprint. Default 0.5 = centered.",
    )
    parser.add_argument(
        "--target-max-mm",
        type=float,
        default=None,
        help=(
            "If set, uniformly scale the model (before hollowing) so its "
            "largest bounding-box dimension equals this value in mm. Use "
            "this when the source STL isn't already sized/exported in real "
            "millimeters -- see the unit-mismatch warning in the README."
        ),
    )
    return parser.parse_args(argv)


def import_stl(filepath: str):
    # Blender 4.x renamed the STL operators (wm.stl_import/export); older
    # versions used import_mesh.stl/export_mesh.stl. Support both so this
    # script works across the common installed versions.
    if hasattr(bpy.ops.wm, "stl_import"):
        bpy.ops.wm.stl_import(filepath=filepath)
    else:
        bpy.ops.import_mesh.stl(filepath=filepath)


def export_stl(filepath: str, obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if hasattr(bpy.ops.wm, "stl_export"):
        bpy.ops.wm.stl_export(filepath=filepath, export_selected_objects=True)
    else:
        bpy.ops.export_mesh.stl(filepath=filepath, use_selection=True)


def rescale_to_target(obj, target_max_mm: float):
    """Uniformly scale so the model's largest bounding-box dimension equals
    `target_max_mm`. Must run before hollow()/cut_drain_hole() -- wall
    thickness and hole diameter are absolute mm values, so if the source
    STL's own units don't already match real-world mm, hollowing first
    produces a wall thickness wildly out of proportion to the model (an
    oversized Solidify shell blows through itself; a fixed-size drain-hole
    cylinder dwarfs the whole model)."""
    bpy.context.view_layer.update()
    world_coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [v.x for v in world_coords]
    ys = [v.y for v in world_coords]
    zs = [v.z for v in world_coords]
    current_max = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    if current_max <= 0:
        raise RuntimeError("Model has zero size; cannot compute a scale factor")

    factor = target_max_mm / current_max
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.transform.resize(value=(factor, factor, factor))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    print(f"[INFO] Rescaled by factor {factor:.4f} (was {current_max:.3f} -> {target_max_mm:.3f})")


def hollow(obj, wall_thickness_mm: float):
    """Add an inward-facing shell so the model becomes a hollow, thin-walled
    solid instead of solid fill. offset=-1 keeps the original outer surface
    in place and grows the new inner wall inward from it."""
    solidify = obj.modifiers.new(name="Hollow_Solidify", type="SOLIDIFY")
    solidify.thickness = wall_thickness_mm
    solidify.offset = -1.0
    solidify.use_even_offset = True
    solidify.use_quality_normals = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solidify.name)


def cut_drain_hole(
    obj,
    wall_thickness_mm: float,
    hole_diameter_mm: float,
    hole_x_fraction: float = 0.5,
    hole_y_fraction: float = 0.5,
):
    """Cut a vertical cylindrical hole through the bottom of the model so
    trapped resin/liquid can drain out of the now-hollow interior.

    The hole is always on the bottom face (drain holes need gravity); its
    X/Y position on that face is `hole_x_fraction` / `hole_y_fraction` of
    the way across the model's own bounding-box footprint (0 = min edge,
    0.5 = center, 1 = max edge) -- fractions rather than absolute mm so the
    same value works regardless of the model's actual size.

    Height uses a simple heuristic: a cylinder tall enough to fully punch
    through the bottom shell and reach well into the interior cavity. For
    unusually flat or thin models, check the result in Blender and
    increase/decrease `depth_factor` below (or reposition the cylinder
    manually) so it doesn't also breach the top.
    """
    bpy.context.view_layer.update()
    mesh = obj.data
    world_coords = [obj.matrix_world @ v.co for v in mesh.vertices]
    min_x, max_x = min(v.x for v in world_coords), max(v.x for v in world_coords)
    min_y, max_y = min(v.y for v in world_coords), max(v.y for v in world_coords)
    min_z = min(v.z for v in world_coords)
    hole_x = min_x + (max_x - min_x) * hole_x_fraction
    hole_y = min_y + (max_y - min_y) * hole_y_fraction

    depth_factor = 6.0  # cylinder height, as a multiple of wall thickness
    cylinder_depth = wall_thickness_mm * depth_factor
    # Position so the cylinder starts slightly below the model's bottom
    # (guarantees a clean cut through the outer shell) and extends upward
    # into the interior.
    cylinder_z = min_z - wall_thickness_mm + cylinder_depth / 2.0

    bpy.ops.mesh.primitive_cylinder_add(
        radius=hole_diameter_mm / 2.0,
        depth=cylinder_depth,
        location=(hole_x, hole_y, cylinder_z),
    )
    cutter = bpy.context.active_object
    cutter.name = "DrainHole_Cutter"

    bpy.context.view_layer.objects.active = obj
    boolean = obj.modifiers.new(name="DrainHole_Boolean", type="BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.object = cutter
    boolean.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier=boolean.name)

    bpy.data.objects.remove(cutter, do_unlink=True)


def main():
    args = parse_args()

    if not os.path.isfile(args.input):
        raise FileNotFoundError(f"Input STL not found: {args.input}")

    bpy.ops.wm.read_factory_settings(use_empty=True)

    import_stl(args.input)
    imported = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    if not imported:
        raise RuntimeError("STL import produced no mesh object")
    obj = imported[0]

    if args.target_max_mm is not None:
        rescale_to_target(obj, args.target_max_mm)

    hollow(obj, args.wall_thickness)
    cut_drain_hole(
        obj,
        args.wall_thickness,
        args.hole_diameter,
        hole_x_fraction=args.hole_x,
        hole_y_fraction=args.hole_y,
    )

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    export_stl(args.output, obj)
    print(f"[OK] Hollowed + drain-hole STL written to: {args.output}")


if __name__ == "__main__":
    main()
