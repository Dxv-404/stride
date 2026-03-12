"""Terrain generators for the physics simulation.

Three terrain types: Flat, Hill, Mixed (+ Gap as stretch goal).
Each terrain adds static line segments to a pymunk space.
"""

import math
import pymunk

from src.creature import TERRAIN_COLLISION_TYPE


class BaseTerrain:
    """Base class for all terrain types."""

    def __init__(self):
        self.segments = []  # pymunk static segments added to space

    def get_height(self, x):
        """Return terrain height at horizontal position x."""
        x = max(-1000, min(10000, x))
        return self._height_function(x)

    def _height_function(self, x):
        raise NotImplementedError

    def add_to_space(self, space):
        """Add terrain geometry as static segments to the pymunk space."""
        raise NotImplementedError


class FlatTerrain(BaseTerrain):
    """Constant height ground at y=50."""

    def _height_function(self, x):
        return 50.0

    def add_to_space(self, space):
        body = space.static_body
        seg = pymunk.Segment(body, (-1000, 50), (10000, 50), 5)
        seg.friction = 1.0
        seg.elasticity = 0.2
        seg.collision_type = TERRAIN_COLLISION_TYPE
        space.add(seg)
        self.segments = [seg]


class HillTerrain(BaseTerrain):
    """Flat ground with a sine-wave bump between x=300 and x=500.

    h(x) = 50 + 50 * sin(pi * (x - 300) / 200)  for 300 <= x <= 500
    h(x) = 50  otherwise
    """

    def _height_function(self, x):
        if 300 <= x <= 500:
            return 50.0 + 50.0 * math.sin(math.pi * (x - 300) / 200)
        return 50.0

    def add_to_space(self, space):
        body = space.static_body
        segs = []

        # Flat section before hill
        s1 = pymunk.Segment(body, (-1000, 50), (300, 50), 5)
        s1.friction = 1.0
        s1.elasticity = 0.2
        s1.collision_type = TERRAIN_COLLISION_TYPE
        segs.append(s1)

        # Hill section — approximate curve with 50 segments
        n_hill_segs = 50
        dx = 200.0 / n_hill_segs
        for i in range(n_hill_segs):
            x0 = 300 + i * dx
            x1 = 300 + (i + 1) * dx
            y0 = self._height_function(x0)
            y1 = self._height_function(x1)
            s = pymunk.Segment(body, (x0, y0), (x1, y1), 5)
            s.friction = 1.0
            s.elasticity = 0.2
            s.collision_type = TERRAIN_COLLISION_TYPE
            segs.append(s)

        # Flat section after hill
        s2 = pymunk.Segment(body, (500, 50), (10000, 50), 5)
        s2.friction = 1.0
        s2.elasticity = 0.2
        s2.collision_type = TERRAIN_COLLISION_TYPE
        segs.append(s2)

        space.add(*segs)
        self.segments = segs


class MixedTerrain(BaseTerrain):
    """Alternating flat and hill sections every 300px.

    Hill appears when (x mod 600) is in [300, 500].
    """

    def _height_function(self, x):
        x_mod = x % 600
        if 300 <= x_mod <= 500:
            return 50.0 + 50.0 * math.sin(math.pi * (x_mod - 300) / 200)
        return 50.0

    def add_to_space(self, space):
        body = space.static_body
        segs = []

        # Build from x=-1000 to x=10000 with fine segments
        # Use a step size that captures the hills accurately
        step = 4.0  # 4px steps (fine enough for smooth hills)
        x = -1000.0
        while x < 10000:
            x_next = min(x + step, 10000.0)
            y0 = self._height_function(x)
            y1 = self._height_function(x_next)
            s = pymunk.Segment(body, (x, y0), (x_next, y1), 5)
            s.friction = 1.0
            s.elasticity = 0.2
            s.collision_type = TERRAIN_COLLISION_TYPE
            segs.append(s)
            x = x_next

        space.add(*segs)
        self.segments = segs


class GapTerrain(BaseTerrain):
    """Flat ground with a gap (no ground) from x=300 to x=350."""

    def _height_function(self, x):
        if 300 <= x <= 350:
            return -1000.0  # effectively no ground
        return 50.0

    def add_to_space(self, space):
        body = space.static_body
        segs = []

        s1 = pymunk.Segment(body, (-1000, 50), (300, 50), 5)
        s1.friction = 1.0
        s1.elasticity = 0.2
        s1.collision_type = TERRAIN_COLLISION_TYPE
        segs.append(s1)

        # No segment for the gap region

        s2 = pymunk.Segment(body, (350, 50), (10000, 50), 5)
        s2.friction = 1.0
        s2.elasticity = 0.2
        s2.collision_type = TERRAIN_COLLISION_TYPE
        segs.append(s2)

        space.add(*segs)
        self.segments = segs


def create_terrain(terrain_type):
    """Factory function to create terrain by name."""
    terrains = {
        "flat": FlatTerrain,
        "hill": HillTerrain,
        "mixed": MixedTerrain,
        "gap": GapTerrain,
    }
    if terrain_type not in terrains:
        raise ValueError(f"Unknown terrain type: {terrain_type}. "
                         f"Choose from {list(terrains.keys())}")
    return terrains[terrain_type]()
