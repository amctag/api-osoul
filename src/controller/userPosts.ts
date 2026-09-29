import { Request, Response } from "express";
import { pool } from "../config/dp";
import { deleteImages, normalizeImageList } from "../utils/imageStorage";
import { canModeratePosts, getAuthActor } from "../utils/helper";

export const getSaved = async (req: Request, res: Response) => {
  const userId = req.body.user_id;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;

  console.log(
    "Fetching saved posts for user:",
    userId,
    "page:",
    page,
    "limit:",
    limit
  );

  const query = `
      SELECT
        p.*,
        TRUE     AS is_saved,
        COUNT(*) OVER() AS total_count
      FROM saved_posts sp
      JOIN posts p
        ON sp.post_id = p.id
      WHERE sp.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
  `;
  const values = [userId, limit, offset];

  try {
    const { rows, rowCount } = await pool.query(query, values);
    const totalCount = rows.length > 0 ? rows[0].total_count : 0;
    const posts = rows.map(({ total_count, ...post }) => post);
    const hasMore = rowCount === limit;
    console.log(posts);

    res.status(200).json({
      page,
      limit,
      hasMore,
      posts,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching saved posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET paginated list of user's own posts
export const getList = async (req: Request, res: Response) => {
  const userId = req.body.user_id;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;

  console.log(
    "Fetching user posts for user:",
    userId,
    "page:",
    page,
    "limit:",
    limit
  );

  const query = `
    SELECT *
    FROM posts
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const values = [userId, limit, offset];

  try {
    const { rows, rowCount } = await pool.query(query, values);
    const hasMore = rowCount === limit;

    res.status(200).json({
      page,
      limit,
      hasMore,
      posts: rows,
    });
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFeatured = (req: Request, res: Response) => {
  const query = "SELECT * FROM posts where is_featured = $1";
  const values = [true];
  pool.query(query, values, (error, results) => {
    if (error) {
      console.error("Error fetching featured posts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
    res.status(200).json({ posts: results.rows });
  });
};

export const getCategoreyPosts = async (req: Request, res: Response) => {
  const category_id = req.body.category_id;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;

  console.log(
    "Fetching posts for category:",
    category_id,
    "page:",
    page,
    "limit:",
    limit
  );

  const query = `
    SELECT *
    FROM posts
    WHERE category_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const values = [category_id, limit, offset];

  try {
    const { rows, rowCount } = await pool.query(query, values);
    const hasMore = rowCount === limit;

    res.status(200).json({
      page,
      limit,
      hasMore,
      posts: rows,
    });
  } catch (error) {
    console.error("Error fetching category posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const filterPosts = async (req: Request, res: Response) => {
  const {
    category_id, //this could work as a bi controller it could get the filtered posts awa the categories
    city_id,
    sale_type_id,
    is_direct,
    condition_id,
    rooms,
    toilets,
    min_land_area,
    min_price,
    max_price,
    user_id,
    request,
    marks_only,
  } = req.body;
  const marksOnly = marks_only === true;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;
  console.log("this is page", page);
  console.log("this is offset", offset);
  let cityIdParam = null;
  if (city_id != null) {
    if (Array.isArray(city_id)) {
      cityIdParam = city_id.map((c) => parseInt(c, 10));
    } else {
      cityIdParam = [parseInt(city_id, 10)];
    }
  }
  const categoryVal =
    category_id != null ? parseInt(category_id as string, 10) : null;
  const conditionVal =
    condition_id != null ? parseInt(condition_id as string, 10) : null;
  const saleTypeVal =
    sale_type_id != null ? parseInt(sale_type_id as string, 10) : null;
  const isDirectVal =
    is_direct != null ? is_direct === true || is_direct === "true" : null;
  const roomsVal = rooms != null ? parseInt(rooms as string, 10) : null;
  const toiletsVal = toilets != null ? parseInt(toilets as string, 10) : null;
  const minLandAreaVal =
    min_land_area != null ? parseInt(min_land_area as string, 10) : null;
  const minPriceVal =
    min_price != null ? parseInt(min_price as string, 10) : null;
  const maxPriceVal =
    max_price != null ? parseInt(max_price as string, 10) : null;
  const userIdVal = user_id ?? null;

  const whereClause = `
      WHERE
        ($1::int[]   IS NULL OR p.city_id      = ANY($1)) AND
        ($2::int     IS NULL OR p.sale_type_id = $2)   AND
        ($3::boolean IS NULL OR p.is_direct    = $3)   AND
        ($4::int     IS NULL OR p.rooms        = $4)   AND
        ($5::int     IS NULL OR p.toilets      = $5)   AND
        ($6::int     IS NULL OR p.land_area   >= $6)   AND
        ($7::int     IS NULL OR p.price       >= $7)   AND
        ($8::int     IS NULL OR p.price       <= $8)   AND
        ($9::int     IS NULL OR p.category_id = $9)    AND
        ($10::int    IS NULL OR p.condition_id= $10)   AND
        ($11::text   IS DISTINCT FROM 'listed' OR p.user_id = $12)
    `;

  const fullSql = `
      SELECT
        p.*,
        CASE
          WHEN $12::text IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM saved_posts sp
            WHERE sp.user_id = $12
              AND sp.post_id = p.id
          )
        END AS is_saved,
        COUNT(*) OVER() AS total_count
      FROM posts p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT  $13
      OFFSET $14
    `;

  const marksSql = `
      SELECT
        ST_X(p.location::geometry) AS longitude,
        ST_Y(p.location::geometry) AS latitude,
        p.id,
        p.category_id,
        p.price,
        p.images,
        p.condition_id,
        p.sale_type_id,
        p.user_id,
        u.full_name_ar,
        u.full_name_en,
        u.company_name_ar,
        u.company_name_en
      FROM posts p
      LEFT JOIN users u
        ON u.user_id = p.user_id
      ${whereClause}
    `;

  let sql: string;
  let values: unknown[];

  if (marksOnly) {
    sql = marksSql;
    values = [
      cityIdParam, // $1
      saleTypeVal, // $2
      isDirectVal, // $3
      roomsVal, // $4
      toiletsVal, // $5
      minLandAreaVal, // $6
      minPriceVal, // $7
      maxPriceVal, // $8
      categoryVal, // $9
      conditionVal, // $10
      request, // $11
      userIdVal, // $12
    ];
  } else {
    sql = fullSql;
    values = [
      cityIdParam, // $1
      saleTypeVal, // $2
      isDirectVal, // $3
      roomsVal, // $4
      toiletsVal, // $5
      minLandAreaVal, // $6
      minPriceVal, // $7
      maxPriceVal, // $8
      categoryVal, // $9
      conditionVal, // $10
      request, // $11
      userIdVal, // $12
      limit, // $13
      offset, // $14
    ];
  }
  console.log("the sql query:", sql, "values: ", values);
  try {
    const { rows, rowCount } = await pool.query(sql, values);
    if (marksOnly) {
      const posts = rows.map((row) => ({
        id: row.id,
        location: {
          longitude: row.longitude,
          latitude: row.latitude,
        },
        images: normalizeImageList(row.images),
        category_id: row.category_id,
        price: row.price,
        condition_id: row.condition_id,
        sale_type_id: row.sale_type_id,
        user_id: row.user_id,
        user: {
          full_name_ar: row.full_name_ar,
          full_name_en: row.full_name_en,
          company_name_ar: row.company_name_ar,
          company_name_en: row.company_name_en,
        },
      }));
      console.log("Posts with locations:", posts);
      res.status(200).json({ posts });
      return;
    }
    const hasMore = rowCount === limit;
    const totalCount = rows.length > 0 ? rows[0].total_count : 0;
    const posts = rows.map(({ total_count, ...post }) => post);
    res.status(200).json({
      page,
      limit,
      hasMore,
      posts,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching filtered posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const savePost = async (req: Request, res: Response) => {
  const post_id = req.query.post_id;
  const user_id = req.query.user_id;

  const checkQuery =
    "SELECT * FROM saved_posts WHERE user_id = $1 AND post_id = $2";
  const checkValues = [user_id, post_id];

  try {
    const checkResult = await pool.query(checkQuery, checkValues);

    if ((checkResult.rowCount ?? 0) > 0) {
      const deleteQuery =
        "DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2 RETURNING *";
      const deleteResult = await pool.query(deleteQuery, checkValues);
      res.status(200).json({
        message: "Post unsaved successfully",
        unsavedPost: deleteResult.rows[0],
      });
      console.log("Post Unsaved");
    } else {
      const insertQuery =
        "INSERT INTO saved_posts(user_id, post_id) VALUES ($1, $2) RETURNING *";
      const insertResult = await pool.query(insertQuery, checkValues);
      res.status(201).json({
        message: "Post saved successfully",
        savedPost: insertResult.rows[0],
      });
      console.log("Post Saved");
    }
  } catch (err) {
    console.error("Error saving/unsaving post:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  const post_id = (req.query.post_id ?? req.params.id) as string | undefined;
  const actor = getAuthActor(req);
  console.log("Deleting post with ID:", post_id, "actor:", actor);

  if (!post_id) {
    res.status(400).json({ message: "Post ID is required" });
    return;
  }

  try {
    const isModerator = await canModeratePosts(actor);
    if (!isModerator) {
      if (!actor.userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const post = await getPostById(post_id);
      if (!post || post.user_id !== actor.userId) {
        res.status(403).json({ message: "Unauthorized or post not found" });
        return;
      }
    }

    const fetchRes = await pool.query(
      `SELECT public_ids FROM posts WHERE id = $1`,
      [post_id]
    );
    if (fetchRes.rowCount === 0) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const publicIds: string[] = fetchRes.rows[0].public_ids || [];
    if (publicIds.length > 0) {
      await deleteImages(publicIds);
    }

    const deleteRes = await pool.query(
      `DELETE FROM posts WHERE id = $1 RETURNING *`,
      [post_id]
    );

    if (deleteRes.rows.length > 0) {
      res.status(200).json({ message: "Post deleted successfully" });
      return;
    }

    res.status(404).json({ message: "Post not found or unauthorized" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllPostsPages = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;

  const query = `
    SELECT *
    FROM posts
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const values = [limit, offset];

  try {
    const { rows, rowCount } = await pool.query(query, values);
    const hasMore = rowCount === limit;

    res.status(200).json({
      page,
      limit,
      hasMore,
      posts: rows,
    });
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getPostById = async (postId: string) => {
  const query = `
    SELECT *
    FROM posts
    WHERE id = $1
  `;
  const values = [postId];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    throw new Error("Internal server error");
  }
};

export const getAdminPost = async (req: Request, res: Response) => {
  const postId = req.query.post_id;
  if (!postId) {
    res.status(400).json({ message: "post_id is required" });
    return;
  }

  const query = `
    SELECT p.*,
      u.full_name_ar AS user_full_name_ar,
      u.user_phone AS user_phone,
      u.commercial_registeration AS commercial_reg,
      u.company_name_ar AS company_name
    FROM posts p
    JOIN users u ON u.user_id = p.user_id
    WHERE p.id = $1
  `;

  try {
    const { rows } = await pool.query(query, [postId]);
    if (rows.length === 0) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const post = rows[0];
    res.status(200).json({
      id: post.id,
      title: post.company_name_ar ?? "شخصي",
      phone: post.user_phone,
      created_at: post.created_at,
      user_full_name_ar: post.user_full_name_ar,
      commercial_reg: post.commercial_reg ?? "لا يوجد سجل تجاري",
      categorey: post.category_id,
      images: normalizeImageList(post.images),
      caption: post.caption,
      city_id: post.city_id,
      sale_type_id: post.sale_type_id,
      condition_id: post.condition_id,
      is_direct: post.is_direct,
      area: post.area,
      building: post.building,
      price: post.price,
      rooms: post.rooms,
      toilets: post.toilets,
      land_area: post.land_area,
      address: post.address,
    });
  } catch (error) {
    console.error("Error fetching admin post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllPosts = async (req: Request, res: Response) => {
  const query = `SELECT p.*, u.full_name_ar AS user_full_name_ar, u.user_phone AS user_phone, u.commercial_registeration
   AS commercial_reg, u.company_name_ar AS
    company_name FROM posts p JOIN users u ON u.user_id = p.user_id ORDER BY created_at DESC`;
  try {
    const { rows } = await pool.query(query);
    const DataToSend = rows.map((post) => {
      return {
        id: post.id,
        title: post.company_name_ar ?? "شخصي",
        phone: post.user_phone,
        created_at: post.created_at,
        user_full_name_ar: post.user_full_name_ar,
        commercial_reg: post.commercial_reg ?? "لا يوجد سجل تجاري",
        categorey: post.category_id,
        image: normalizeImageList(post.images)[0],
      };
    });
    res.status(200).json(DataToSend);
  } catch (error) {
    console.error("Error fetching all posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
