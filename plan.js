// Gym plan: 9 Oct 2026 (Day 3) -> 21 Oct 2026 (Day 15). Lower-back safe. Upper body only — no legs, no core. Plain browser JS.
(function () {
  // ---------- helpers ----------
  function it(id, sets, reps, restSec, note) {
    return { id: id, sets: sets, reps: reps, restSec: restSec, note: note };
  }
  function blk(name, durationMin, items) {
    return { name: name, durationMin: durationMin, items: items };
  }

  var TM = {
    walk: "Brisk walk 5.5–6 km/h, 1% incline. Stand tall, don't hold the rails.",
    walkJog: "Walk 3 min at 6 km/h, then alternate 1 min easy jog (7.5–8 km/h) / 1 min walk. Stop jogging if your back feels anything.",
    jog: "Light jog 7.5–8.5 km/h if comfortable; walk any part that feels jarring. You should be able to talk.",
    easy: "Easy brisk walk 5.5–6 km/h, 1% incline. Today is about loosening up, not pace."
  };

  function treadmill(note) {
    return blk("Treadmill", 9, [it("treadmill_1km", 1, "1 km", 60, note)]);
  }

  // Short on time: 2 standing moves, ~2 min. Nothing on the floor.
  function warmup() {
    return blk("Warm-up", 2, [
      it("bar_pass_through", 1, "10 slow", 0, "Light rod, very wide grip — loosens shoulders and upper back"),
      it("light_db_raise", 1, "10", 0, "2–3 kg only — just waking the shoulders up")
    ]);
  }

  function finisher(kind, min, note) {
    return blk("Finisher", min, [it(kind, 1, min + " min", 0, note)]);
  }

  // Every day ends with the same two arm moves, ~5 min.
  function armsFinisher() {
    return blk("Arms Finisher", 5, [
      it("preacher_curl_machine", 2, "12", 45, "Upper arms stay glued to the pad; lower slowly"),
      it("wrist_roller", 2, "1 up + down", 45, "Light plate; roll it all the way up, then lower it slowly")
    ]);
  }

  // ---------- exercise library ----------
  var exercises = {
    machine_row: {
      name: "Machine Row (Chest-Supported)", equipment: "Chest-supported row machine", target: "Mid back, lats",
      cues: ["Chest on the pad, feet planted", "Grip handles, arms straight", "Pull elbows back close to your sides", "Squeeze shoulder blades 1 s, return slowly"],
      backSafety: "The chest pad holds your back still — keep your chest on it the whole set."
    },
    straight_arm_pulldown: {
      name: "Straight-Arm Pulldown", equipment: "High cable with bar or rope", target: "Lats",
      cues: ["Stand facing the high cable, slight forward lean, knees soft", "Arms straight, hands at eye level", "Sweep the bar down to your thighs", "Return slowly to eye level"],
      backSafety: "Lock your lean in place before starting — the hips don't move during the rep."
    },
    pec_deck: {
      name: "Pec Deck", equipment: "Pec deck / fly machine", target: "Chest",
      cues: ["Seat so handles are at chest height", "Back flat on the pad, slight elbow bend", "Bring the handles together in front of your chest", "Squeeze 1 s, open slowly to a mild stretch"],
      backSafety: "Keep your back on the pad; don't let the weight pull your arms too far back."
    },
    incline_chest_press_machine: {
      name: "Incline Chest Press Machine", equipment: "Incline chest press machine", target: "Upper chest, front shoulders",
      cues: ["Seat so handles line up with upper chest", "Back and head on the pad", "Press up and forward without locking elbows", "Lower slowly until a mild chest stretch"],
      backSafety: "Seated and back-supported — keep your lower back on the pad, no arching."
    },
    lateral_raise_machine: {
      name: "Lateral Raise Machine", equipment: "Lateral raise machine", target: "Side shoulders (width)",
      cues: ["Sit tall, pads on the outside of your upper arms", "Raise arms out to shoulder height, leading with elbows", "Pause 1 s at the top", "Lower slowly"],
      backSafety: "Sit tall with your chest against the pad; light weight, no shrugging or leaning."
    },
    reverse_pec_deck: {
      name: "Reverse Pec Deck", equipment: "Pec deck machine (facing the pad)", target: "Rear shoulders, upper back",
      cues: ["Sit facing the pad, chest against it", "Grip handles at shoulder height, arms nearly straight", "Sweep arms back and out", "Squeeze 1 s, return slowly"],
      backSafety: "Chest stays on the pad — that keeps your back supported the whole time."
    },
    cable_curl: {
      name: "Cable Curl", equipment: "Low cable with straight bar", target: "Biceps",
      cues: ["Stand tall facing the low cable, slight knee bend", "Elbows pinned to your sides", "Curl the bar to your shoulders", "Lower slowly until arms are straight"],
      backSafety: "Stand tall and squeeze your glutes — if you lean back to lift, it's too heavy."
    },
    hammer_curl_seated: {
      name: "Seated Hammer Curl", equipment: "Bench with back support + dumbbells", target: "Biceps, forearms",
      cues: ["Sit with your back against an upright bench", "Dumbbells at your sides, thumbs up", "Curl up keeping thumbs up", "Lower slowly"],
      backSafety: "Pick the dumbbells up from a rack at hip height, never off the floor."
    },
    seated_dip_machine: {
      name: "Seated Dip Machine", equipment: "Seated tricep dip machine", target: "Triceps",
      cues: ["Back on the pad, grip the handles beside you", "Elbows pointing back, close to your body", "Push handles down until arms are straight", "Return slowly, stop at a comfortable bend"],
      backSafety: "Back stays on the pad; don't lean forward to push."
    },
    bar_pass_through: {
      name: "Bar Pass-Through", equipment: "Long light rod / body bar", target: "Shoulders, upper back — warm-up",
      cues: ["Stand tall, feet hip-width, slight knee bend", "Hold the rod with a very wide overhand grip, arms straight", "Slowly lift it over your head and back toward your lower back", "Bring it back over to the front; widen your grip if it's tight"],
      backSafety: "Keep ribs down and don't arch your lower back to get the rod behind you — widen the grip instead."
    },
    light_db_raise: {
      name: "Light Dumbbell Raise", equipment: "Light dumbbells (2–3 kg)", target: "Shoulders — warm-up",
      cues: ["Stand tall, a dumbbell in each hand at your sides", "Raise both arms in front to shoulder height, thumbs up", "Lower slowly, then raise out to the sides to shoulder height", "Smooth and light — this is a warm-up, not a set"],
      backSafety: "Use light weights so you never lean back or swing. Squeeze your glutes to keep your back neutral."
    },
    preacher_curl_machine: {
      name: "Preacher Curl Machine", equipment: "Preacher curl machine", target: "Biceps",
      cues: ["Set the seat so your armpits sit at the top of the pad", "Upper arms flat on the pad, grip the handles", "Curl up, squeeze 1 s at the top", "Lower slowly until arms are almost straight"],
      backSafety: "Sit tall with your chest against the pad — you're seated and supported, so no swinging needed."
    },
    wrist_roller: {
      name: "Wrist Roller", equipment: "Wrist roller stand", target: "Forearms, grip",
      cues: ["Stand tall, grip the handle with both hands, palms down", "Turn one wrist then the other to roll the rope up", "Roll until the plate reaches the handle", "Unroll slowly — the way down counts too"],
      backSafety: "Use a light plate and stand tall; if you lean back to lift it, it's too heavy."
    },
    treadmill_1km: {
      name: "Treadmill 1 km", equipment: "Treadmill", target: "Heart, legs — warm-up",
      cues: ["Start slow for the first 200 m", "Stand tall, eyes forward, arms swinging naturally", "Short, quiet steps — land under your hips", "Don't grip the handrails"],
      backSafety: "Keep strides short; long over-reaching steps jolt the lower back. Walk instead of jog if anything twinges."
    },
    stationary_bike: {
      name: "Stationary Bike", equipment: "Upright or recumbent bike (recumbent is best for the back)", target: "Low-impact cardio, legs",
      cues: ["Seat height: slight bend in knee at the bottom of the pedal", "Sit tall, chest open, light grip", "Steady cadence ~80 rpm, moderate resistance", "Finish the last minute easy"],
      backSafety: "Prefer the recumbent (back-supported) bike. Don't hunch over the handlebars."
    },
    incline_walk: {
      name: "Incline Walk", equipment: "Treadmill", target: "Fat burn, glutes, low-impact cardio",
      cues: ["Set 5–8% incline, 4.5–5.5 km/h", "Stand upright — lean only slightly from the ankles", "Hands off the rails", "Breathing should be heavier but you can still talk"],
      backSafety: "If you need the rails or start leaning forward from the waist, lower the incline."
    },
    lat_pulldown: {
      name: "Lat Pulldown", equipment: "Lat pulldown machine", target: "Lats, upper back (V-shape)",
      cues: ["Thighs locked under the pad, grip a bit wider than shoulders", "Lean back only slightly, chest up", "Pull bar to upper chest by driving elbows down", "Control it back up to full stretch"],
      backSafety: "Always pull to the front, never behind the neck. Torso stays still — if you have to rock or swing, the weight is too heavy."
    },
    seated_cable_row: {
      name: "Seated Cable Row", equipment: "Cable row station (chest pad if available)", target: "Mid back, lats, posture",
      cues: ["Sit tall, slight knee bend, chest up", "Pull handle to your lower ribs, elbows close", "Squeeze shoulder blades together 1 s", "Let arms straighten forward without rounding your back"],
      backSafety: "Torso stays still and upright — brace abs before each pull. Don't lean forward to reach or lean back to yank; use the chest pad if there is one."
    },
    chest_press_machine: {
      name: "Chest Press (Machine)", equipment: "Seated chest press machine", target: "Chest, front shoulders, triceps",
      cues: ["Seat height: handles at mid-chest", "Back flat against the pad, shoulder blades pulled back", "Press out smoothly, don't lock elbows", "Return slowly until a mild chest stretch"],
      backSafety: "Feet flat on the floor, back stays on the pad — don't arch to push more weight."
    },
    shoulder_press_machine: {
      name: "Shoulder Press (Machine)", equipment: "Seated shoulder press machine with back pad", target: "Shoulders, triceps",
      cues: ["Seat so handles start at shoulder height", "Back and head against the pad", "Press up without fully locking elbows", "Lower slowly to shoulder height"],
      backSafety: "Seated with back support only — never standing. Brace abs so the lower back stays on the pad; if it arches, the weight is too heavy."
    },
    face_pull: {
      name: "Face Pull", equipment: "Cable machine with rope, set at face height", target: "Rear shoulders, upper back, posture",
      cues: ["Rope at face height; step back until arms are straight, light weight", "Pull rope toward your forehead, pulling the ends apart", "Elbows stay high, squeeze shoulder blades together 1 s", "Return slowly over 2 s"],
      backSafety: "Stand tall with soft knees, staggered stance for balance. Light weight — no leaning back."
    },
    db_curl_seated: {
      name: "Seated Dumbbell Curl", equipment: "Incline/upright bench + dumbbells", target: "Biceps",
      cues: ["Sit with back against the bench pad", "Elbows pinned by your sides", "Curl up, turn palms to face you, squeeze", "Lower slowly over 2–3 s"],
      backSafety: "Back supported on the pad, torso never moves. Take dumbbells from the rack at hip height — never bend over to lift them off the floor."
    },
    tricep_pushdown: {
      name: "Tricep Pushdown", equipment: "Cable machine with rope or bar, set high", target: "Triceps",
      cues: ["Stand tall, elbows tucked at your sides", "Push down until arms are straight, squeeze", "Only the forearms move", "Control the way up"],
      backSafety: "Stand upright with soft knees and abs lightly braced; don't lean over the cable or hunch to push heavier."
    }
  };

  // ---------- days ----------
  var days = [
    // Day 3
    {
      date: "2026-10-09", dayNumber: 3, title: "Upper Body — Foundation",
      focus: "Learn the machines, light weight (RPE 5–6)", type: "workout",
      tip: "Get protein at every meal (eggs, paneer, dal, chicken, curd). It keeps you full and helps muscles recover.",
      blocks: [
        treadmill(TM.walk),
        warmup(),
        blk("Main", 37, [
          it("lat_pulldown", 3, "12", 75, "Light — learn to pull with the elbows, not the hands"),
          it("chest_press_machine", 3, "12", 75, "Adjust seat so handles are at mid-chest"),
          it("seated_cable_row", 3, "12", 75, "Sit tall; squeeze shoulder blades"),
          it("shoulder_press_machine", 2, "12", 60, "Back flat on the pad; stop just short of locking elbows"),
          it("db_curl_seated", 2, "12", 45, "Back against the bench; no swinging"),
          it("tricep_pushdown", 2, "12", 45, "Elbows pinned to your sides; stand tall, slight knee bend")
        ]),
        finisher("stationary_bike", 7, "Easy-moderate pace; recumbent bike if available"),
        armsFinisher()
      ]
    },
    // Day 4
    {
      date: "2026-10-10", dayNumber: 4, title: "Back Attack",
      focus: "Pull day — lats, mid back, rear shoulders, biceps (RPE 5–6)", type: "workout",
      tip: "Drink about 3 L of water today. Carry a bottle — most 'hunger' between meals is thirst.",
      blocks: [
        treadmill(TM.walk),
        warmup(),
        blk("Main", 38, [
          it("lat_pulldown", 3, "12", 75, "Pull to upper chest, elbows drive down"),
          it("machine_row", 3, "12", 75, "Chest stays on the pad; squeeze shoulder blades"),
          it("seated_cable_row", 3, "12", 60, "Sit tall; handle to your belly"),
          it("straight_arm_pulldown", 2, "15", 45, "Arms straight; feel the lats, not the triceps"),
          it("reverse_pec_deck", 3, "15", 45, "Light; squeeze the back of the shoulders"),
          it("cable_curl", 3, "12", 45, "Elbows pinned; no swinging")
        ]),
        finisher("incline_walk", 6, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 5
    {
      date: "2026-10-11", dayNumber: 5, title: "Push Day Power",
      focus: "Push day — chest, shoulders, triceps (RPE 5–6)", type: "workout",
      tip: "Cut sugary drinks and juices completely — it's the easiest fat-loss win with zero effort in the gym.",
      blocks: [
        treadmill(TM.walk),
        warmup(),
        blk("Main", 38, [
          it("chest_press_machine", 3, "12", 75, "Handles at mid-chest; back flat on the pad"),
          it("incline_chest_press_machine", 3, "12", 75, "Press up and forward; control the return"),
          it("pec_deck", 3, "12", 60, "Slight elbow bend; squeeze the chest 1 s"),
          it("shoulder_press_machine", 3, "12", 60, "Back flat on the pad; stop short of locking elbows"),
          it("lateral_raise_machine", 3, "15", 45, "Lead with the elbows, up to shoulder height"),
          it("seated_dip_machine", 3, "12", 45, "Back on the pad; push down beside your hips")
        ]),
        finisher("stationary_bike", 6, "Easy-moderate pace; recumbent bike if available"),
        armsFinisher()
      ]
    },
    // Day 6
    {
      date: "2026-10-12", dayNumber: 6, title: "Arms & Shoulders",
      focus: "Shoulders and arms — light and smooth (RPE 5–6)", type: "workout",
      tip: "Aim for 7–8 hours of sleep. Muscle repair and appetite control both get worse when you're short on sleep.",
      blocks: [
        treadmill(TM.walk),
        warmup(),
        blk("Main", 38, [
          it("shoulder_press_machine", 3, "12", 60, "Back flat on the pad; light and smooth"),
          it("lateral_raise_machine", 3, "15", 45, "Up to shoulder height, lower slowly"),
          it("reverse_pec_deck", 3, "15", 45, "Squeeze the rear shoulders"),
          it("cable_curl", 3, "12", 45, "Elbows pinned to your sides"),
          it("hammer_curl_seated", 3, "12", 45, "Thumbs up; back against the bench"),
          it("tricep_pushdown", 3, "12", 45, "Elbows pinned; squeeze at the bottom"),
          it("seated_dip_machine", 3, "12", 45, "Back on the pad; full push down")
        ]),
        finisher("incline_walk", 6, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 7
    {
      date: "2026-10-13", dayNumber: 7, title: "V-Shape Builder",
      focus: "Wide back, chest, shoulders, arms (RPE 6)", type: "workout",
      tip: "Walk 8,000 steps today outside the gym — take calls on foot. It burns more than the finisher does.",
      blocks: [
        treadmill(TM.walkJog),
        warmup(),
        blk("Main", 38, [
          it("lat_pulldown", 3, "12", 75, "Wide grip, pull to upper chest"),
          it("chest_press_machine", 3, "12", 75, "Control the return"),
          it("machine_row", 3, "12", 60, "Chest on the pad, elbows close"),
          it("pec_deck", 2, "12", 45, "Slow squeeze"),
          it("lateral_raise_machine", 3, "15", 45, "Width for the V-shape"),
          it("face_pull", 2, "15", 45, "Elbows high, posture"),
          it("db_curl_seated", 2, "12", 45, "Slow lowering"),
          it("tricep_pushdown", 2, "12", 45, "Elbows pinned")
        ]),
        finisher("incline_walk", 6, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 8
    {
      date: "2026-10-14", dayNumber: 8, title: "Pull Harder",
      focus: "Pull day — small weight increases if form is clean (RPE 6–7)", type: "workout",
      tip: "Fill half your plate with vegetables at lunch and dinner. Same fullness, far fewer calories.",
      blocks: [
        treadmill(TM.walkJog),
        warmup(),
        blk("Main", 38, [
          it("lat_pulldown", 3, "12", 75, "Pull to upper chest, elbows drive down"),
          it("machine_row", 3, "12", 75, "Chest stays on the pad; squeeze shoulder blades"),
          it("seated_cable_row", 3, "12", 60, "Sit tall; handle to your belly"),
          it("straight_arm_pulldown", 2, "15", 45, "Arms straight; feel the lats, not the triceps"),
          it("reverse_pec_deck", 3, "15", 45, "Light; squeeze the back of the shoulders"),
          it("cable_curl", 3, "12", 45, "Elbows pinned; no swinging")
        ]),
        finisher("stationary_bike", 6, "Easy-moderate pace; recumbent bike if available"),
        armsFinisher()
      ]
    },
    // Day 9
    {
      date: "2026-10-15", dayNumber: 9, title: "Light Pump",
      focus: "Easy upper-body pump — half weights, recover (RPE 5)", type: "workout",
      tip: "Keep eating normally — don't crash diet. A small daily deficit is enough; starving makes you look flat and tired.",
      blocks: [
        treadmill(TM.easy),
        warmup(),
        blk("Main", 34, [
          it("face_pull", 2, "15", 45, "Light — posture, not effort"),
          it("seated_cable_row", 2, "15", 45, "About half your normal weight"),
          it("pec_deck", 2, "15", 45, "Light, slow squeeze"),
          it("lateral_raise_machine", 2, "15", 45, "Light, smooth"),
          it("cable_curl", 2, "15", 45, "Light pump"),
          it("tricep_pushdown", 2, "15", 45, "Light pump")
        ]),
        finisher("incline_walk", 10, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 10
    {
      date: "2026-10-16", dayNumber: 10, title: "Press On",
      focus: "Push day — small weight increases (RPE 6–7)", type: "workout",
      tip: "Check your posture at your desk: screen at eye level, feet flat, get up every 45 minutes. Sitting slumped is hard on a recovering back.",
      blocks: [
        treadmill(TM.walkJog),
        warmup(),
        blk("Main", 38, [
          it("chest_press_machine", 3, "12", 75, "Handles at mid-chest; back flat on the pad"),
          it("incline_chest_press_machine", 3, "12", 75, "Press up and forward; control the return"),
          it("pec_deck", 3, "12", 60, "Slight elbow bend; squeeze the chest 1 s"),
          it("shoulder_press_machine", 3, "12", 60, "Back flat on the pad; stop short of locking elbows"),
          it("lateral_raise_machine", 3, "15", 45, "Lead with the elbows, up to shoulder height"),
          it("seated_dip_machine", 3, "12", 45, "Back on the pad; push down beside your hips")
        ]),
        finisher("stationary_bike", 6, "Easy-moderate pace; recumbent bike if available"),
        armsFinisher()
      ]
    },
    // Day 11
    {
      date: "2026-10-17", dayNumber: 11, title: "Wide & Strong",
      focus: "V-shape day — your best form of the plan (RPE 6–7)", type: "workout",
      tip: "Go easy on alcohol this weekend — it adds empty calories and water retention, and wrecks sleep.",
      blocks: [
        treadmill(TM.jog),
        warmup(),
        blk("Main", 38, [
          it("lat_pulldown", 3, "12", 75, "Wide grip, pull to upper chest"),
          it("chest_press_machine", 3, "12", 75, "Control the return"),
          it("machine_row", 3, "12", 60, "Chest on the pad, elbows close"),
          it("pec_deck", 2, "12", 45, "Slow squeeze"),
          it("lateral_raise_machine", 3, "15", 45, "Width for the V-shape"),
          it("face_pull", 2, "15", 45, "Elbows high, posture"),
          it("db_curl_seated", 2, "12", 45, "Slow lowering"),
          it("tricep_pushdown", 2, "12", 45, "Elbows pinned")
        ]),
        finisher("incline_walk", 6, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 12
    {
      date: "2026-10-18", dayNumber: 12, title: "Easy Pull Sunday",
      focus: "Light pull day — posture and recovery (RPE 5)", type: "workout",
      tip: "Plan your travel outfit and get a haircut booked this week — honestly, it changes how you look more than 4 extra days of gym will.",
      blocks: [
        treadmill(TM.easy),
        warmup(),
        blk("Main", 34, [
          it("lat_pulldown", 2, "15", 75, "Light — about 60% of Day 8"),
          it("machine_row", 2, "15", 75, "Light — about 60% of Day 8"),
          it("seated_cable_row", 2, "15", 60, "Light — about 60% of Day 8"),
          it("straight_arm_pulldown", 2, "15", 45, "Light — about 60% of Day 8"),
          it("reverse_pec_deck", 2, "15", 45, "Light — about 60% of Day 8"),
          it("cable_curl", 2, "15", 45, "Light — about 60% of Day 8")
        ]),
        finisher("incline_walk", 10, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 13
    {
      date: "2026-10-19", dayNumber: 13, title: "Arms & Shoulders II",
      focus: "Same moves as Day 6, +2.5 kg if it felt easy (RPE 6)", type: "workout",
      tip: "Start cutting back on salt today (pickles, namkeen, packaged snacks, restaurant food). Less salt for 3 days = less puffiness in the face and belly.",
      blocks: [
        treadmill(TM.jog),
        warmup(),
        blk("Main", 38, [
          it("shoulder_press_machine", 3, "12", 60, "Back flat on the pad; light and smooth"),
          it("lateral_raise_machine", 3, "15", 45, "Up to shoulder height, lower slowly"),
          it("reverse_pec_deck", 3, "15", 45, "Squeeze the rear shoulders"),
          it("cable_curl", 3, "12", 45, "Elbows pinned to your sides"),
          it("hammer_curl_seated", 3, "12", 45, "Thumbs up; back against the bench"),
          it("tricep_pushdown", 3, "12", 45, "Elbows pinned; squeeze at the bottom"),
          it("seated_dip_machine", 3, "12", 45, "Back on the pad; full push down")
        ]),
        finisher("incline_walk", 6, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    },
    // Day 14
    {
      date: "2026-10-20", dayNumber: 14, title: "Push Day Peak",
      focus: "Push day, moderate weights — no soreness tomorrow (RPE 6)", type: "workout",
      tip: "Keep salt low and water high (~3 L). Skip heavy, oily dinners — you'll wake up less bloated.",
      blocks: [
        treadmill(TM.jog),
        warmup(),
        blk("Main", 38, [
          it("chest_press_machine", 3, "12", 75, "Handles at mid-chest; back flat on the pad"),
          it("incline_chest_press_machine", 3, "12", 75, "Press up and forward; control the return"),
          it("pec_deck", 3, "12", 60, "Slight elbow bend; squeeze the chest 1 s"),
          it("shoulder_press_machine", 3, "12", 60, "Back flat on the pad; stop short of locking elbows"),
          it("lateral_raise_machine", 3, "15", 45, "Lead with the elbows, up to shoulder height"),
          it("seated_dip_machine", 3, "12", 45, "Back on the pad; push down beside your hips")
        ]),
        finisher("stationary_bike", 6, "Easy-moderate pace; recumbent bike if available"),
        armsFinisher()
      ]
    },
    // Day 15
    {
      date: "2026-10-21", dayNumber: 15, title: "Pump & Go",
      focus: "Light V-shape pump — stay fresh for travel (RPE 5)", type: "workout",
      tip: "Pack tonight, eat a normal low-salt dinner, sleep early. Stand tall tomorrow — good posture is the quickest 'look better' there is.",
      blocks: [
        treadmill(TM.easy),
        warmup(),
        blk("Main", 39, [
          it("lat_pulldown", 2, "15", 75, "Light pump"),
          it("chest_press_machine", 2, "15", 75, "Light pump"),
          it("machine_row", 2, "15", 60, "Light pump"),
          it("pec_deck", 2, "15", 45, "Light pump"),
          it("lateral_raise_machine", 2, "15", 45, "Light pump"),
          it("face_pull", 2, "15", 45, "Light pump"),
          it("db_curl_seated", 2, "15", 45, "Light pump"),
          it("tricep_pushdown", 2, "15", 45, "Light pump")
        ]),
        finisher("incline_walk", 5, "5–6% incline, 5 km/h, hands off the rails"),
        armsFinisher()
      ]
    }
  ];

  window.PLAN = {
    startDate: "2026-10-09",
    tripDate: "2026-10-22",
    dayNumberOffset: 2,
    exercises: exercises,
    days: days
  };
})();
