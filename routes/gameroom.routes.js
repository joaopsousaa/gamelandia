const router = require("express").Router();
const fs = require("fs");

// Models
const GameRoomModel = require("../models/GameRoom.model");

// Middlewares
const isLoggedIn = require("../middleware/isLoggedIn");
const ifUserExists = require("../middleware/ifUserExists");

// Mongoose
const { isValidObjectId } = require("mongoose");
const { ObjectId } = require("mongoose").Types;

// ---------------------- Router Configs ---------------------- //
router.use(isLoggedIn);
router.use(ifUserExists);

// -------------------------- Routes ------------------------ //

// GET /create - Render the create game room page
router.get("/create", (req, res) => {
  const { user } = req;

  GameRoomModel.find({ players: user._id, status: { $ne: "finished" } }).then(
    (gameRooms) => {
      if (gameRooms.length > 0) {
        return res.redirect("/");
      }
    }
  );

  const applistJson = fs.readFileSync("./applist.json");

  const games = JSON.parse(applistJson).applist.apps;

  res.render("gameroom/create", { games });
});

// POST /create - Create a new game room
router.post("/create", (req, res) => {
  const { user } = req;
  const { game } = req.body;
  let { name, minPlayers = 2, maxPlayers = 2 } = req.body;

  if (!name) {
    name = `${user.username}'s Game Room`;
  }

  if (!game) {
    return res.status(400).render("gameroom/create", {
      errorMessage: "Please choose a game.",
    });
  }

  if (minPlayers < 2) {
    minPlayers = 2;
  }

  if (maxPlayers < 2) {
    maxPlayers = 2;
  }

  if (maxPlayers < minPlayers) {
    return res.status(400).render("gameroom/create", {
      errorMessage: "Your Max Players can't be smaller than your Min Players",
    });
  }

  GameRoomModel.create({
    name,
    game,
    owner: user,
    players: user,
    minPlayers,
    maxPlayers,
  }).then((gameroom) => {
    return res.status(200).redirect(`/gameroom/${gameroom._id}`);
  });
});

// GET /:gameRoomId - Render the game room page
router.get("/:gameRoomId", (req, res) => {
  const { gameRoomId } = req.params;
  const { user } = req;
  const isValidId = isValidObjectId(gameRoomId);

  if (!isValidId) return res.status(400).redirect("/");

  GameRoomModel.find({
    _id: { $ne: gameRoomId },
    players: user._id,
    status: { $ne: "finished" },
  })
    .then((gameRooms) => {
      if (gameRooms.length > 0) return res.status(400).redirect("/");

      GameRoomModel.findById(gameRoomId).then((gameRoom) => {
        if (!gameRoom) return res.status(400).redirect("/");
        if (gameRoom.owner.equals(ObjectId(user._id)))
          return res.render("gameroom/enter", { gameRoom });
        if (gameRoom.players.includes(user._id))
          return res.render("gameroom/enter", { gameRoom });
        if (gameRoom.players.length === gameRoom.maxPlayers)
          return res.status(400).redirect("/");

        GameRoomModel.findByIdAndUpdate(gameRoomId, {
          $push: { players: user._id },
          new: true,
        }).then((gameroom) => {
          if (!gameroom) return res.status(400).redirect("/");
          res.render("gameroom/enter", { gameroom });
        });
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).redirect("/");
    });
});

// GET /:gameRoomId/leave - Leave the game room (or delete it if you're the owner)
router.get("/:gameRoomId/leave", (req, res) => {
  const { gameRoomId } = req.params;
  const { user } = req;
  const isValidId = isValidObjectId(gameRoomId);

  if (!isValidId) return res.status(400).redirect("/");

  GameRoomModel.findById(gameRoomId)
    .then((gameroom) => {
      if (!gameroom) return res.status(400).redirect("/");

      console.log(gameroom.owner._id);
      console.log(user._id);

      if (gameroom.owner.equals(ObjectId(user._id))) {
        GameRoomModel.findByIdAndDelete(gameRoomId).then((gameroom) => {
          if (!gameroom) return res.status(400).redirect("/");
        });
      }

      GameRoomModel.findByIdAndUpdate(gameRoomId, {
        $pull: { players: user._id },
      }).then((gameroom) => {
        if (!gameroom) return res.status(400).redirect("/");
      });
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).redirect("/");
    });
});

// GET /:gameRoomId/play - Change the game room status to "playing"
router.get("/:gameRoomId/play", (req, res) => {
  const { gameRoomId } = req.params;
  const { user } = req;
  const isValidId = isValidObjectId(gameRoomId);

  if (!isValidId) return res.status(400).redirect("/");

  GameRoomModel.findById(gameRoomId).then((gameroom) => {
    if (!gameroom) return res.status(400).redirect("/");
    if (!gameroom.owner.equals(ObjectId(user._id)))
      return res.status(400).redirect(`/gameroom/${gameRoomId}`);
    GameRoomModel.findByIdAndUpdate(gameRoomId, {
      status: "playing",
    }).then((gameroom) => {
      return res.status(200).redirect(`/gameroom/${gameRoomId}`);
    });
  });
});

// GET /:gameRoomId/finish - Change the game room status to "finished"
router.get("/:gameRoomId/finish", (req, res) => {
  const { gameRoomId } = req.params;
  const { user } = req;
  const isValidId = isValidObjectId(gameRoomId);

  if (!isValidId) return res.status(400).redirect("/");

  GameRoomModel.findById(gameRoomId).then((gameroom) => {
    if (!gameroom) return res.status(400).redirect("/");
    if (!gameroom.owner.equals(ObjectId(user._id)))
      return res.status(400).redirect(`/gameroom/${gameRoomId}`);
    GameRoomModel.findByIdAndUpdate(gameRoomId, {
      status: "finished",
    }).then((gameroom) => {
      return res.status(200).redirect(`/gameroom/${gameRoomId}`);
    });
  });
});

// ----------------------------------------------------------- //

module.exports = router;
