OV.GeneratorParams = class
{
    constructor ()
    {
        this.name = null;
        this.material = null;
        this.transformation = null;
    }

    SetName (name)
    {
        this.name = name;
        return this;
    }

    SetMaterial (material)
    {
        this.material = material;
        return this;
    }

    SetTransformation (translation, rotation, scale)
    {
        const matrix = new OV.Matrix ().ComposeTRS (translation, rotation, scale);
        return this.SetTransformationMatrix (matrix);
    }

    SetTransformationMatrix (matrix)
    {
        this.transformation = new OV.Transformation (matrix);
        return this;
    }
};

OV.Generator = class
{
    constructor (params)
    {
        this.params = params || new OV.GeneratorParams ();
        this.mesh = new OV.Mesh ();
        if (this.params.name !== null) {
            this.mesh.SetName (this.params.name);
        }
        this.curve = null;
    }

    GetMesh ()
    {
        return this.mesh;
    }

    AddVertex (x, y, z)
    {
        let coord = new OV.Coord3D (x, y, z);
        if (this.params.transformation !== null) {
            coord = this.params.transformation.TransformCoord3D (coord);
        }
        return this.mesh.AddVertex (coord);
    }

    AddVertices (vertices)
    {
        let indices = [];
        for (let i = 0; i < vertices.length; i++) {
            let vertex = vertices[i];
            indices.push (this.AddVertex (vertex.x, vertex.y, vertex.z));
        }
        return indices;
    }

    SetCurve (curve)
    {
        this.curve = curve;
    }

    ResetCurve ()
    {
        this.curve = null;
    }

    AddTriangle (v0, v1, v2)
    {
        let triangle = new OV.Triangle (v0, v1, v2);
        if (this.params.material !== null) {
            triangle.SetMaterial (this.params.material);
        }
        if (this.curve !== null) {
            triangle.SetCurve (this.curve);
        }
        return this.mesh.AddTriangle (triangle);
    }

    AddTriangleInverted (v0, v1, v2)
    {
        this.AddTriangle (v0, v2, v1);
    }

    AddConvexPolygon (vertices)
    {
        for (let vertexIndex = 0; vertexIndex < vertices.length - 2; vertexIndex++) {
            this.AddTriangle (
                vertices[0],
                vertices[vertexIndex + 1],
                vertices[vertexIndex + 2]
            );
        }
    }

    AddConvexPolygonInverted (vertices)
    {
        for (let vertexIndex = 0; vertexIndex < vertices.length - 2; vertexIndex++) {
            this.AddTriangleInverted (
                vertices[0],
                vertices[vertexIndex + 1],
                vertices[vertexIndex + 2]
            );
        }
    }    
};

OV.GeneratorHelper = class
{
    constructor (generator)
    {
        this.generator = generator;
    }

    GenerateExtrude (vertices, height, curve)
    {
        let topPolygon = [];
        let bottomPolygon = [];
        for (let i = 0; i < vertices.length; i++) {
            const vertex = vertices[i];
            bottomPolygon.push (this.generator.AddVertex (vertex.x, vertex.y, 0.0));
            topPolygon.push (this.generator.AddVertex (vertex.x, vertex.y, height));
        }
        this.generator.SetCurve (curve);
        this.GenerateSurfaceBetweenPolygons (bottomPolygon, topPolygon);
        this.generator.ResetCurve ();
        this.generator.AddConvexPolygonInverted (bottomPolygon);
        this.generator.AddConvexPolygon (topPolygon);
    }

    GenerateSurfaceBetweenPolygons (startIndices, endIndices)
    {
        if (startIndices.length !== endIndices.length) {
            return;
        }
        const vertexCount = startIndices.length;
        for (let i = 0; i < vertexCount; i++) {
            const index = i;
            const nextIndex = (i < vertexCount - 1) ? index + 1 : 0;
            this.generator.AddConvexPolygon ([
                startIndices[index],
                startIndices[nextIndex],
                endIndices[nextIndex],
                endIndices[index]
            ]);
        }
    }

    GenerateTriangleFan (startIndices, endIndex)
    {
        const vertexCount = startIndices.length;
        for (let i = 0; i < vertexCount; i++) {
            const index = i;
            const nextIndex = (i < vertexCount - 1) ? index + 1 : 0;
            this.generator.AddTriangle (
                endIndex,
                startIndices[index],
                startIndices[nextIndex]
            );
        }
    }    
};

OV.GenerateCuboid = function (genParams, xSize, ySize, zSize)
{
    let generator = new OV.Generator (genParams);
    let vertices = [
        new OV.Coord2D (0.0, 0.0),
        new OV.Coord2D (xSize, 0.0),
        new OV.Coord2D (xSize, ySize),
        new OV.Coord2D (0.0, ySize),
    ];
    let helper = new OV.GeneratorHelper (generator);
    helper.GenerateExtrude (vertices, zSize, null);
    return generator.GetMesh ();
};

OV.GenerateCylinder = function (genParams, radius, height, segments, smooth)
{
    function GetCylindricalCoord (radius, angle)
    {
        return new OV.Coord2D (
            radius * Math.cos (angle),
            radius * Math.sin (angle)
        );
    }

    if (segments < 3) {
        return null;
    }

    let generator = new OV.Generator (genParams);
    let baseVertices = [];
	const step = 2.0 * Math.PI / segments;
	for (let i = 0; i < segments; i++) {
        let cylindrical = GetCylindricalCoord (radius, i * step);
		baseVertices.push (cylindrical);
	}
    let helper = new OV.GeneratorHelper (generator);
    helper.GenerateExtrude (baseVertices, height, smooth ? 1 : null);
    return generator.GetMesh ();    
};

OV.GenerateSphere = function (genParams, radius, segments, smooth)
{
    function GetSphericalCoord (radius, theta, phi)
    {
        return new OV.Coord3D (
            radius * Math.sin (theta) * Math.cos (phi),
            radius * Math.sin (theta) * Math.sin (phi),
            radius * Math.cos (theta)
        );
    }

    if (segments < 3) {
        return null;
    }

    let generator = new OV.Generator (genParams);
    let helper = new OV.GeneratorHelper (generator);

    generator.SetCurve (smooth ? 1 : null);

    let allLevelVertices = [];
    let levels = segments + 1;
    const levelStep = Math.PI / segments;
	const cylindricalStep = 2.0 * Math.PI / segments;
    for (let levelIndex = 1; levelIndex < levels - 1; levelIndex++) {
        let levelVertices = [];
        let theta = levelIndex * levelStep;
        for (let cylindricalIndex = 0; cylindricalIndex < segments; cylindricalIndex++) {
            let phi = cylindricalIndex * cylindricalStep;
            let vertex = GetSphericalCoord (radius, theta, -phi);
            levelVertices.push (generator.AddVertex (vertex.x, vertex.y, vertex.z));
        }
        if (levelIndex > 1) {
            helper.GenerateSurfaceBetweenPolygons (allLevelVertices[allLevelVertices.length - 1], levelVertices);
        }
        allLevelVertices.push (levelVertices);
    }

    let topVertex = generator.AddVertex (0.0, 0.0, radius);
    let bottomVertex = generator.AddVertex (0.0, 0.0, -radius);
    helper.GenerateTriangleFan (allLevelVertices[0].slice ().reverse (), topVertex);
    helper.GenerateTriangleFan (allLevelVertices[allLevelVertices.length - 1], bottomVertex);
    
    generator.ResetCurve ();

    return generator.GetMesh ();    
};
