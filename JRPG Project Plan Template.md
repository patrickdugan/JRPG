# JRPG PROJECT PLAN TEMPLATE

#### By Patrick Holleman

submissions@thegamedesignforum.com

 

Hello\! This is a template of a project plan for making a JRPG, start to finish. Using this template, you can get a clear idea of what it would take to plan, produce, test and release your own JRPG. **This is not a tutorial on how to get started as a game developer. This is a template for the production of a commercial JRPG**. I use this in my own games\!

Who am I? I’m a game designer, writer and project manager specializing in JRPGs. I’ve worked (in various capacities) on Quartet, Threads of Time, Cris Tales, Coromon, Forge of the Fae  and My Familiar. I also wrote academic research books about Final Fantasy VI, Chrono Trigger, Final Fantasy VII, and Diablo II. (I’ve also worked on many games that never got announced and will never come out. Many of the examples in this document come from those.) 

Between my development experience and thousands of hours of research, I’ve learned a lot about how JRPGs are made. Here’s what I know.

# **My Best, Shortest Advice**

There are three bits of wisdom which more experienced developers have imparted to me. I have seen these things to be painfully true, and so I can absolutely verify their accuracy.

* Small changes to a game can have very big effects. If you don’t like something in your game, make a small change first. Don’t overreact.  
* If you absolutely must make big changes to your game, it is ***much*** cheaper at the beginning than in the middle or end of a project. Large, late changes are very expensive.  
  * This doesn’t mean you don’t iterate. You do. JRPGs are roughly 80% vision, 20% iteration.  
  * Also, if you’re making big, late changes, this means you had a vision problem. Make sure your vision is strong at the beginning, and stick to it.  
*  Ideas aren’t worth much. You think you have a great idea for an RPG? So do millions of other people. Most of those people have way more game development experience than you do. What matters in game development is executing your idea in a rational, skilled, and focused way.

**If you’d like to skip around the rest of the document, open the show tabs and outlines button, on the left.** 

# **Milestones**

We can divide the project into milestones. If you don’t have any stakeholders (like a publisher), these milestones can be chosen rationally and ordered in a natural way. If you have a publisher or are receiving money from someone who is not a game dev, they might make you do things in a totally nonsensical way. That’s just how the games industry works. But, however you do it, understand that the development of a JRPG is a fairly well-trod process. You are not going to reinvent it.

*  First, we create vision documentation for the entire game  
  * This includes systems, plot, asset lists. All of it goes on paper.  
    * A full game script, or at least a large chunk of it, is not a bad idea.  
  * We should expect to document \~80% of the final vision. We’ll discover the other 20% along the way. (That 20% is where you iterate.)  
    * But we don’t want to leave too much for later decisions, or else we’ll end up paying for the same content multiple times.  
* Next, we hire key contractors, especially visual artists, to create the “one true screenshots” and teaser video for the game.  
* After this vision has been established, we commence full production.  
  * Full production begins with creating 80-90% of the systems and tools  
    * This assumes the remaining 10-20% will emerge later in the process  
  * At the same time, we should start creating art assets.  
    * Environments should take first priority. Using temporary “gray box” environment assets is tricky in JRPGs.   
      * You can use temporary assets for certain things, especially dungeons.   
      * Temporary assets are less suitable for things like key scene locations and towns. You will probably have to redo a significant amount of work if those are gray-boxed. That’s just JRPGs, for you.   
    * Creating the final character sprites/models is, surprisingly, much less important. You can use temporary character sprites/models fairly deep into development without creating huge problems, as long as the sprites/models are the same size as the finished asset.  
    * Battles are also easy to use dummy art for, since you’re mostly focusing on smoothing out the user experience, and getting the balance of stats correct.

Now, from that high-level view, let’s take a look at each step.

## **Design Documentation**

The first milestone is documentation of the game’s systems. This will let us know what kinds of assets we need to make, in both art and code. Again, the goal is to hit roughly 80% of the final vision in these documents. The final 20% is relatively easy to add later, but making major changes late in the process can **raise your costs by** **50%** of your planned budget. If you have ever read a news story about a game that was disastrously expensive, it is almost always the result of making late changes beyond that 20% of iteration-friendly content/systems.

Note that all the time estimates below are for a team of 5-25 people, not including short-term contractors. Above 25 people, time estimates would be different. That said, larger productions must perform all of these steps, too

### **Vision Doc**

**TIME TO FIRST VERSION: Up to 1 month (could be shorter, but going longer won’t help)**

**BLOCKS: All tasks**

The **vision doc** is the first document. What does it need to accomplish?

The vision doc communicates your vision to your lead designer, art director, writers and lead producer. (Sometimes one person occupies more than one of those roles.) This is the first thing you make that they can give you feedback on. The vision doc should be around 10 pages long. (It can be longer if most of that extra length is art samples.)

* The vision doc must clearly communicate your **genre, hook and tone**.  
  *  **Genre**, in this case, means the genre of your story/world. Is it a medieval, sword-and-sorcery story? Is it a cyberpunk dystopia? We need to know, now.  
    *  Don’t make the mistake of saying you’re creating a new genre or that your game doesn’t belong in any genre. It’s not true, and it just confuses your team. Would you rather feel original, or would you rather have your game come out?  
  * **Hook** means the mechanical feature that separates your game from others that are similar. Do you travel through time? Do your characters ride dragons into battle? Do you cast magic by dancing with two motion-controllers in your hands? Tell us the hook. Don’t worry about the little details of how it’s going to work. We’ll get there in another document.  
  * **Tone** is about how seriously the story and systems are treated. Is your game grimly serious, like Elden Ring? Is half-joking, like Portal? Is it a comedic parody, like Disgaea? This matters to your story, yes, but it also affects your game’s color palette, how enemies are designed, how camera work is done, even the look of the UI. All of these things must reinforce the tone.

Now, while keeping genre/tone/hook in mind, answer these questions.

**Battle system basics**  
o   How do characters take turns?  
o   What unique abilities exist for characters?  
o   How many party members are active in battle at one time?  
o   How many party members are there, total?  
o   How many gear slots are there on a character?  
o   What is the level-up system like? Is there anything like a skill tree?  
o   Describe the game’s **hook** and the evolution of the hook  
 **Battle system sketches**  
o   Rough mockups of what we’re trying to do, especially with the unique hook  
§  A PowerPoint or other demo of the hook is a good idea  
o   A vision board (examples) of models, environments and FX  
§  Just steal screenshots from other games. Mix and match.  
o   Gear UI sketches. Just rough sketches of all the slots.  
 **Key character biography and sketches**  
o   Short biographies of each party member and major antagonist  
o   Sketches or clipped art showing what each character looks like  
**Key locations and sketches**  
o   Descriptions of key locations, associated major factions  
o   Sketches of key locations, especially major cities, story-important dungeons, and home base (if there is one)  
o   Try to keep this to 5 or fewer locations, to start. You can add more later.  
**Highest-level plot beats**  
o   This is just a very short outline of the game.  
o   How is the world of your game different from the real world?  
o   Who are we? Why are we on our quest?  
o   Where do we go? What’s the twist in the middle (if any)? How does it end?

### **Technical GDD**

**TIME TO COMPLETION: 3-6 weeks**

**BLOCKS: All programming tasks**

The technical GDD is a much more detailed document which is handed to the programming team so that they can begin work. It requires the vision doc to be complete.

The technical GDD describes, in great detail, how every single mechanic in the game works. This includes how stories are told via the cutscene editor tools, and map-specific mechanics, too.

The technical GDD can be a shorter task if it re-uses an existing engine’s codebase for some mechanics, like taking turns, creating enemy AI behavior, or the math of debuffs.

You should expect this document to be between 40 and 70 pages, unless you’re adopting an engine that already has many of your features built in.

## **Script Outline**

For a JRPG, a detailed script outline is essential. JRPGs have huge amounts of bespoke content, and that content requires a very large number of assets. Production of those assets cannot begin until the outline reaches the 80% final state, at which point an authoritative asset list can be made.

### **Beats Outline**

**TIME TO COMPLETION: 2 weeks or less**

**BLOCKS: Further outlines, asset list**

This is your first draft, created to include every plot idea you have. We might shave off a few scope bombs or things that are just inherently incompatible with other, more essential plot ideas. That’s normal, even for professional writers.

Here, we’ll divide the game into chapters (even if we don’t ever show players that division) and mark out their major plot beats.

* What is the chapter’s quest?  
* What towns or dungeons do we visit?  
*  What characters do we meet?  
*  What bosses do we fight?

And just repeat that for each chapter, up to the end of the game.

### **Detailed Outline**

**TIME TO COMPLETION: 2-4 weeks**

**BLOCKS: Asset list**

This is a more technical outline in which we nail down 80% of the scenes, in specific order.

It’s also worth working a theme into the bullet points. Every story has a theme, but this is the first time you might see yours emerge.

### **Asset List**

**TIME TO COMPLETION: 3-8 weeks**

**BLOCKS: Most art tasks**

This is the master asset list for the game, from which artists will work. Even though content production is slow in an RPG, art will lag behind if you don’t get your artists started, right now.

This list will need to cover 80-90% of the art assets for the game. Most important are:

* Locations and tilesets (or textures/lighting for 3D games)  
*  Major characters and their animations  
*  UI elements

Monster/enemy art and skill animations are less urgent. They can easily be added later in the project.

The reason this task takes so long is that you need **art references** for literally every object on the list. By the time the project has generated 60-70% of its final assets, many artists will be able to operate with fewer references, since they understand the style and have some of their own ideas. But until then, you’ll be spending literal weeks on the internet, downloading photos, videos and asset packs as examples, plus making sketches of so many inane things you didn’t think of before. It’s a huge task.

You might be tempted to use AI, but your artists will hate you. Artists are *very hard* to replace. So don’t do that.

## **One True Screenshots**

The “one true screenshot” is not just a marketing tool. These screenshots also communicate the feel of the game to the people working on it. This is important, because game developers have a ***very high*** incidence of neurodivergence and learning disabilities, like dyslexia and ADHD. You could write a three-book series about your game’s vision, but half the team might not ever get past the first page. Ergo, we make these screenshots. Most developers will understand those.

For an RPG, we need three screenshots and one video. These are: a battle shot, a world/story shot, and a menu shot. At a later time, we can make a mockup video teaser. These screenshots must convey your genre, hook and tone, at a glance.

### **Battle Shot**

### **Time to completion: varies (2-5 weeks, can vary a lot based on what assets are already done)**

**Blocks: Battle front end, hiring artists**

The battle shot should show a full party, fighting against visually interesting enemies. None of this needs to be coded or playable. The battle hook should be on display. This shot can be a short gif, but that isn’t necessary for internal use.

Breaking the normal rules of battle is perfectly acceptable for this shot, especially by showing multiple actions at once.

The most important thing is to convey the genre, the turn-based nature, and the game’s unique mechanical hook.

### **World/Story Shot**

**Time to completion: varies (2-5 weeks, again; it depends on if you already have assets)**

**Blocks: hiring artists**

The world/story shot should focus very hard on the genre and tone of the story. Half or more of players read a genre label and either don’t know what it means, or don’t trust it.

Likewise, players care a *lot* about tone, even though they couldn’t tell you what “tone” means or what the tone of their favorite work is. If your mechanics are different than the player expects, they might tolerate it and accept a new experience. But if your tone doesn’t match player expectations, you will have a huge problem.

For example, what is the tone of Final Fantasy VI? It’s clearly serious. But how serious? The answer to that question isn’t “very serious” or “somewhat serious.” The answer tells you *what kind* of seriousness. Final Fantasy VI has an **operatic** tone.

* Larger-than-life emotions  
* Over-the-top characterizations (especially the villains)  
* But all the characters take the story completely seriously.  
  * They’re not winking at the camera during those over-the-top moments.  
* There are moments of humor, even over-the-top humor (like Ultros). But again, the characters react sincerely to those moments.

FFVI pulls off this tone by being consistent. You should too. Having an inconsistent tone will kill your game, even though your players wouldn’t be able to explain that fact to you.

### **Menu Shot**

**Time to completion: varies (1-2 weeks)**

**Blocks: menu programming**

The goal of the menu shot is to show the player the level of complexity and customization in the menu. Is this a complex game with lots of systems and gear/perk slots to manage? Or is it simple and breezy? A menu can show that. It’s also a good place to get a look at the character designs.

### **Video Teaser**

**Time to completion: 1-2 weeks (but this requires having all the assets and anims done for other tasks)**

**Blocks: Battle scripting**

The video teaser is less essential than the screenshots, as far as the internal team is concerned. For some members, especially animators and effect/battle scripters, it will be essential. Those things tend to come much later than any of the tasks we’ve discussed so far.

The video teaser is just an animated version of your battle shot and maybe some environments. It is not an announcement trailer for your game.

## **Engine Creation/Customization**

The widest range of possibilities exists here, depending on what mechanics you settle on in earlier documents/decisions. You must ask yourself what you want out of your project. Do you want to start making content a month from now? Is that the only way you can stay motivated and focused? Then you might want to use an off-the-shelf RPG engine like RPGMaker. But if you want to do innovative things from the beginning, it might be wise to build your own engine, or license a more powerful engine from someone who has already made an RPG. If that engine is well made, it can be customized to your needs. (Even companies as big as Nintendo will reach out to indie devs for this; Cadence of Hyrule is a re-skin of Crypt of the Necrodancer.)

Whatever engine you use, understand that some of the features below will become available to you in *stages*. That is, you can use early versions of some things. An early prototype of maps and exploration is probably the first thing you can expect, since tools for that don’t need to be reinvented. Battles will come in stages, too, with new mechanics entering play, one by one. It’s a good idea to polish the *usability* of each mechanic fairly well before the next one comes. With that in mind, you don’t need to perfectly *balance* each mechanic as it comes online. Later mechanics may alter the global balance.

Small changes have big effects.

### **Asset Management**

**TIME TO COMPLETION: 1-2 days**

**BLOCKS: Playtesting, content generation**

The first step is to create a git repository for game assets, and a Google Drive for sharing vision material with the rest of the team. The tech director will create the repository, since they already have some specialized controls implemented for moving videogame assets back and forth. A completely raw repository will create a variety of problems, especially when using engines like Unity and Unreal. Most senior programmers have some custom scripting built into their asset management.

### **World and Field Maps/Interaction**

**TIME TO COMPLETION: Staged, 2 weeks to 4 months**

**BLOCKS: Scene and dungeon production**

World and field maps will be available in stages. Depending on how many off-the-shelf code assets you use, you may be able to move around the world, interact with scene and environment objects, and experience collisions on the first day of production. Getting the exact kind of camera and trigger functionality that your game needs will take around two weeks.

If you want specialized dialogue boxes (with comic book tails, for example), those will arrive 1-3 weeks after camera, collision and other more fundamental things.

If your game requires special depth sorting for the art assets, you can extend this step to at least 4 months. Depth sorting refers to the way a game sorts objects at different diegetic elevations, in a 2D environment. Think of walking behind tall buildings vs standing on their roofs. Believe it or not, it’s not easy to do those two things on the same map\!

### **Battle Mechanics**

**TIME TO COMPLETION: 1-8 months.**

**BLOCKS: Battle production, character and enemy kit development**

This is where the real work takes place. If you build a battle system from scratch, it will take at least 4 months. It could take most of a year. 

If you take an existing turn-based engine and add a hook and a few new mechanics, you can start using parts of that system right away (literally right away)\! Your first mechanics will arrive one by one, starting around the 1-month mark.

Of all the parts of the game, you should expect that combat will evolve the slowest. That said, it is still very important to stay within the 80%/20% guidelines. If you try to change/reinvent more than 20% of the battle system late into development, it will be much more expensive. It can be done\! It’s your money. But believe me when I say that even your contractors don’t want to waste your money. They want to ship games.

Now, let’s say you were inspired to make this your game by, say, Clair Obscur: Expedition 33\. If you implement the kind of extremely robust timed hit mechanics seen in Clair Obscur, expect to add several months to develop rich balance tools and animation controllers for that. Rudimentary timed attacks for player-characters can be implemented somewhat quickly, but don’t let that fool you about the size of the task. Player attacks are always the same, and there are only a few dozen of them. Timed defends are, by far, the most scope-heavy aspect of such a system. Enemy attacks vary greatly, and there are hundreds of them to balance.

### **Stat and Gear System**

**TIME TO COMPLETION: 1-3 Months**

**BLOCKS: Dungeon balancing**

Programmers may consider this to be part of the battle system, and they’re right in some ways.  However, there are many things which can be tested in the battle system without the stat system being entirely complete.

The element of this feature which extends the development time the most is extra functions on gear. What are “extra functions?”

* Gear which alters the player’s skill kit  
*  Gear which alters timed hits  
* Consumable stat-boosting items (tabs)  
* Gear which changes the on-screen appearance of party members  
  * There are different levels to this. Changing colors or adding a PFX overlay or shader is easier than changing the shape of the character’s silhouette. The latter adds another month of development, at least.  
* Gear or stats which have a variety of mathematical effects on resource systems, like gold, EXP or ability points.  
* Ambient stat modifiers. For example, dungeons that apply math to your stats across all battles, because of an aura or curse.

Extra effects also have a multiplying effect on one another, as you add more of them. That is, these extra effects tend to interact with each other in tricky ways, from the perspective of computer science. Finding and solving all the bugs and race conditions in your systems gets more complicated as more systems are overlaid.

(I will take this moment to flash back to the beginning of the document. Small changes have big effects.)

Many productions also take this step to create shops, or at least the data model for them. The front end for shops usually waits until chapter 1\.

### **Data Management**

**TIME TO COMPLETION: 1-2 Months**

**BLOCKS: Dungeon testing and progression testing**

Data management means things like save files, locking the position of your airship on the world map, progression through the game, achievements, and even culling assets as they pass off of the screen. All of this data needs to be handled by a back end.

Some parts of this are not essential to testing things like the battle system. And, at any rate, the battle system will need a great deal of testing which can be done in parallel to this.

### **FX Engine**

**TIME TO COMPLETION: 1-3 Months**

**BLOCKS: Nothing**

If there are specific visual effects that happen often and require some extra engine support to streamline, then programmers need to spend time making those tools usable for artists and battle scripters.

These visual effects do not block anything except external tests. All the math and user experience polish can be done around them.

## **Content Pipeline**

The content pipeline is a set of tools which the programmers will hand to artists, designers and scripters. Good tools make content production much easier. Bad or insufficient tools can delay games by months or years. (See the chapter on Destiny in Jason Schreier’s book *Blood, Sweat and Pixels.*)

**Level Tooling**

**TIME TO COMPLETION: 2 weeks to 3 months**

**BLOCKS: Level development, scene development**

All games need some sort of level editor. Level editors are the most common off-the-shelf development tool. It is possible to create your own level editor, but it is probably the least wise tool to make from scratch. Customizing an existing editor (like Tiled or Unreal’s native 3D level editor) can be a fairly low-cost way of accomplishing any level design goals you might have.

Fancy level functions, like bespoke overlays and moving layers, can be constructed in parallel to the basic development of levels.

### **Scene Tooling**

**TIME TO COMPLETION: 2 weeks to 4 months**

**BLOCKS: Scene development, battle animations**

Scene tooling refers to the scripting language in which scenes are written. As with level design, it’s not a great idea to reinvent the wheel, here. Adopting an existing 2D scripting schema (like Yarn or Ink) is much faster.

To accomplish your vision for scenes, some new functions will need to be added. This is always the case. That said, the more off-the-shelf functions you adopt, the faster and cheaper this feature will be to make.

This scripting language is also a great tool for creating battle animations. Using scripting, devs with the title “effect scripter” can take a relatively small number of sprites/models, PFX and animations and turn them into hundreds or thousands of different attacks.

This is another feature which you should expect some late-breaking development for. Adding miscellaneous new features onto a scripting system is fairly easy, even late into development. Revising the whole system is not.

### **Battle Tooling**

**TIME TO COMPLETION: 2 weeks – 3 months**

**BLOCKS: Battle development**

Battle tooling is the front-end which attaches to the battle system. It allows designers to create items, equipment, enemies, enemy AI, and attacks/effects. The only concern with this tool is ease of use. There are off-the-shelf tools like Articy Draft which will do the job, and can be used within a week of the back end being ready. Articy has some quirks that make it annoying to use for certain things, however (especially version control). A more customized solution will be less of a headache and more responsive to your particular needs, but it will require months of development. There may exist a newer off-the-shelf solution out there, but I am not currently aware of it. A tech director can opine on this with more insight.

## **First Playable**

The first playable build is a section of content, usually 20-40 minutes long, which is built to test the robustness of all the systems. It also helps to further cement the vision and generate media which can face the public. It does not have to be the beginning of the game; in fact, it rarely is.

### **First Playable (FP) Script**

**TIME TO COMPLETION: 1-2 weeks**

**BLOCKS: FP development and asset list**

Once chosen from the preproduction outline, the script for the FP is relatively straightforward to write. However, it is a blocker for the asset list for the FP, and therefore forms a major blocker.

The first playable asset list is not a separate task, but a selection from the master asset list.

### **First Playable (FP) Assets**

**TIME TO COMPLETION: 1-5 months**

**BLOCKS: FP content, to a limited degree**

These are assets for the FP. The length of time needed to create them can vary based on what assets have already been created during the vision-finding part of preproduction. All assets created for this step are usable in the full game. Also, much of the FP content can be created with dummy sprites and gray-boxing of the dungeon. (If the first playable content is not going to be used in the full game, gray-boxing the scenes and towns is less of a risk.)

### **FP Entities**

**TIME TO COMPLETION: 1-3 weeks**

**BLOCKS: FP testing**

These are entities like triggers, camera pulls, NPCs, bookshelves, treasure chests, etc. Things that you place on a map. It takes a lot longer to make, place, and polish all of these than you’d expect, but it depends on the length of the script. If there are any puzzles in the FP, the completion time for this step goes up to its maximum.

### **FP Battles**

**TIME TO COMPLETION: 2-5 weeks**

**BLOCKS: Dungeon balance for FP**

Battles for the FP. Battles take weeks of work to get right, even under the best conditions. Given that this is the first dungeon you will design, these battles will probably take longer as you discover the voice of the battle system in a real dungeon with real testers.

If the battle system and tooling are complete, these battles can be started outside of their linear context in the dungeon. They may need to be modestly revised when placed in the dungeon context.

### **FP Maps**

**TIME TO COMPLETION: 1-4 weeks**

**BLOCKS: Dungeon balance for FP**

These are the maps for the first playable. The amount of time they take depends very heavily upon the kind of art you choose to produce: more complicated, flashy art systems have much more intricate map-building processes. The tooling for maps will also definitely go through iteration the first time it is used, if the maps are graphically intensive. A less-intensive style will hit the ground running more quickly.

The amount of time spent on maps also depends on the size of the FP content. A town, world map, and a full-sized dungeon would take a lot longer than just a short dungeon. A bigger slice of content in the FP tests the systems more thoroughly, but extends the amount of time before amateur players can test it.

Puzzle content may further extend this step.

### **FP Scenes**

**TIME TO COMPLETION: 1-4 weeks**

**BLOCKS: Nothing important**

Scripted scenes, including NPC and object interactions in the FP. As with maps, the length of this step depends greatly on how much content there is to make.

## **Chapter 1**

Now we’re making content that will definitely be in the final game. Chapter 1 is the first time, in making content, that nothing should be left undone. Shops and some small features (especially graphical features) can be left out of the FP, but chapter 1 should be final.

What is a chapter? Usually it consists of one town, one dungeon, and one boss. Some variations will exist at key story moments, but the average chapter will follow this formula.

### **C1 Script**

**TIME TO COMPLETION: 2-5 weeks**

**BLOCKS: Chapter 1 production**

If you have not chosen to write the full script, or at least a large part of it, in preproduction, this will have to be done well in advance of the production of chapter 1\. This will ensure that all the requisite assets are ready at the time.

Certain scenes can be made with dummy sprites, but content in this chapter should not be temporary where it is not absolutely necessary. Gray-boxing content is common in shooters and action games, but in a JRPG, gray-boxing towns and scene locations just means paying for content 1.5 times. You should assume that the vision is 80% accurate when production begins. The final 20% can be discovered as you go.

(I reiterate: it is possible to get very rudimentary level layouts for dungeons that don’t cost much to paint over. Scenes, by contrast, need final level designs, or you’ll have to redo many of them.)

### **C1 Assets**

**TIME TO COMPLETION: Varies greatly**

**BLOCKS: Chapter 1 production (except some dummying of scenes)**

Just a sub-section of the asset list, especially for art.

Because early chapters cannot re-use existing assets, they take roughly twice as long to produce as later chapters. By the fifth or sixth chapter, production will be 1.5 \- 2x as fast, as long as that chapter is not extra long and does not contain any elaborate, animated set pieces.

### **C1 Entities**

These are the triggers, puzzles, NPCs, camera pulls, and shops for the chapter. They take time, but it’s hard to say without seeing the script. Plan accordingly.

### **C1 Battles**

A chapter’s worth of battles will always take at least a month to perfectly polish, though the upper bound can vary considerably.

### **C1 Maps**

A chapter’s worth of maps is at least 2 weeks of work from the level designer, but can vary a lot depending on what kind of chapter it is, and how long.

### **C1 Scenes**

A chapter’s worth of scenes, complete with polish and revision, is usually a full-time month. Long chapters, or chapters with extremely involved scenes, can be double or triple this length.

### **C1 Playtest**

Get some people to play this chapter\! You should have 4-10 people playing your chapters as you go, to make sure fundamental things are not horribly broken or incomprehensible.

Small changes, early on, can have truly colossal effects\!

## **Chapter 2**

Here, we simply repeat the process of chapter 1\. Then we do it for chapter 3, etc.

### **C2 Script**

### **C2 Assets**

### **C2 Entities**

### **C2 Battles**

### **C2 Maps**

### **C2 Scenes**

### **C2 Playtest**

# Final Playtests

**Time to Completion: 1-3 months. The longer the better.**

**Blocks: release**

You should be playtesting each chapter as you finish it. That said, you must also playtest the full game as a whole. There are many things which won’t be evident in a single chapter that will be very obvious in the whole game. Pacing is the most important thing to track, across chapters. But you will also run into tech problems which can only be discovered by playing many hours.

Try to get at least 50 playtesters. Compile all of your feedback into a spreadsheet. Don’t fix things which only bother 1-5 people out of your testing cohort, unless they’re (a) bugs or (b) extremely easy (typos, text clarity, collision, small UI tweaks).

# **Contractors/Staff**

In this section, we’re going to look at the people you’ll need to hire to make your game. If you’re a hobbyist making an extremely indie game, maybe you won’t hire anyone. In that case, skip this section. If you do plan on hiring anyone—even a few part-time workers, you’ll find solid advice below.

There are three important things I’ve learned about hiring while making JRPGs.

*  **You should hire based on relevant experience, not brand names**. If you’re making your first game and you have a budget, you may be tempted to hire people with the flashiest resumes. You see a designer who worked for Ubisoft, an animator who worked at Id, a programmer who worked at Treyarch. Those people have great pedigrees, but if they don’t have RPG experience, you are going to have problems. There are many RPG-specific problems, and RPG-specific skills to solve them. Experienced devs from other genres can learn, but do you really want to pay them to learn? Hire someone who has direct RPG experience. Direct experience trumps a flashy name on a resume.  
  * This is somewhat less true for artists than other roles, but RPG experience should still be a very important line item in a resume.  
* **Hire for the appropriate role**. Not everyone who has been an artist can be an art director. Not everyone who has been a coder can be a tech director. If you have a smaller team, you don’t have the redundancy in staff that would allow you to take risks with your personnel. Hire someone who has done the thing already, because you might only have one shot. If you can’t find a full-time department director, negotiate for them to be part-time. It’s common\!  
* **You get what you pay for.** Time and again, I’ve seen first time creators try to squeeze free or greatly-discounted work out of professionals. Or they hire very inexperienced workers to do critical jobs. Both of these are bad ideas. If you hire a professional, you should expect to pay for their services. Trying to finesse your contractor with a nebulous budget, implied threats of termination, moving the goalposts, or vague feedback will not get you what you want. Your contractor is a professional who has valuable experience and knowledge. Hire them or not. Fire them if it isn’t working out.  
  * On the other hand, if you hire someone very new and inexpensive, be aware that you’ll be paying for them to learn on the job. Also be aware that it may cost more time and money to fix their mistakes than it does to hire someone to do it right the first time. Would you hire a plumber with only a few months of experience?  
  * If you bring on unpaid/equity partners, the most likely outcome is that they leave the project and/or barely do anything. But even if they do stay, they will never work harder than they see you, the creator, working.

One very important tip for hiring anyone in any role: if your contractors think that your game is never going to come out, they will change their behavior very quickly. You will not get the best out of them. Why do they think your game is never going to come out?

* The vision is unclear, or the director can’t communicate what they want  
* There are endless changes to the same sections of gameplay  
* Production keeps slowing down as you get deeper into the project. It should be speeding up.  
* People are constantly being hired, fired, and shuffled around the production

If these things happen, your workers will enter survival mode. They need to feed their families, so they will make work for themselves, at your expense. If your vision is clear and your game is making progress, they will work harder and more passionately.

## **Artists**

**Art director** – This is usually the highest paid person on the project, at least on a per-hour basis. This person sets the palette, style, and may even determine certain technological flows in the engine to make the art render faithfully. Many art directors also have a team of artists they can bring on to produce art in quantity.

The art director’s total costs depend on if they also work as a production artist. Some art directors are just that—directors. They direct other artists and only produce a few concepts and key frames. The animation, different facing frames, etc, are all produced by artists below the director.

**Tile/environment artist** – The first person you should hire, if the art director does not do this job. Environment art is expensive, and it’s not very efficient to use dummy art for towns and scenes. You end up just having to paint over them, and it can cost 25-50% of the original work on that town or scene.

**Animator** – Many pixel artists think they can animate well. They’re only right about half of the time. Dedicated animators must be kept at hand. The end of production will also uncover a large number of small animations that were previously unthought of.

For 3D models, the person doing the animating is a totally separate role from the person making the models. (Unless your production is very small.)

**Background Artist** – Most pixel artists think they can do large background paintings well, but this is rare. Even highly skilled artists struggle with the shading in large spaces with natural light. Hire someone specialized in this. 

For 3D workflows, there’s still usually a separate person who creates backgrounds like skyboxes. And there’s usually someone else who does the lighting for these. 3D is expensive.

### **Programmers**

**Tech Lead/Director** – Usually the second-highest paid team member. This person is responsible for the high-level tech decisions, like engine considerations, porting to different platforms, tech debt, asset management, etc. You want someone with good experience. If you try to go cheap on this role, you’ll just end up paying more, later.

That said, the tech lead doesn’t always work many hours on the project, if you’re a small team. They might delegate most of the actual production to junior programmers, while they work on several projects at once.

**Engine Programmer** – A mid-level programmer responsible for implementing the engine customizations ordered by the tech lead. This person will generally handle requests which don’t arise from preproduction. With that in mind, you should try to avoid late-breaking changes to the engine. 80% vision, 20% iteration.

**Gameplay Programmer** – A programmer dedicated to executing things which are already possible in the engine, but perhaps too difficult/inefficient for a designer or scripter to do in the scripting language (scripts like Yarn or Ink). This role may be held by the engine programmer, depending on how many hours per month the game needs. This position is only separate if the engine programmer is consistently busy.

A big role for this person is to expose engine components to the scripting language or other tools, as it becomes necessary for designers to access them in new ways.

**Scripting Support** – This is someone who writes in the in-engine scripting system to accomplish gameplay tasks. They generally will not be writing in C\#; they will almost exclusively write in the scripting language. This person is often a junior designer, as well.

Another key role for this person is writing common events (macros). That is, writing scripting-language shortcuts that we can call for later, instead of inventing new methods in C\#.

### **Design Support**

**Senior Designer** – Generally, this is my role. The senior designer handles big-picture decisions about things like how the math works, how we accomplish the tone and genre. We work to future-proof the game’s systems against likely iterations, and we keep an eye on the larger pacing and balance issues. You, the client, decide what you want in the game. We figure out how to accomplish it, and warn you when today’s actions might become tomorrow’s landmines. Us senior designers have already made all the mistakes; let us guide you around making them again.

This role also helps to implement key battles, scenes and puzzles. You have the vision, but the senior designer is going to be faster at bringing it to life.

**Junior Designer** – A junior designer is responsible for implementing gameplay elements that the director and senior designer have a clear vision for (and maybe a GDD), but don’t have time to do themselves. Generally, they stay inside the lines of what the director and senior designer tell them. But they usually have experience enough to implement the vision much faster than a first-time creator.

**Level Designer** – This is someone who is very quick with using level editors. They may also be good at making interesting level designs, but they may not. Being good at designing interesting levels is a bonus, not a necessity. Level designers should always be given a rough sketch of the maps they make, or else they might make too much. (Making too little isn’t as dangerous; you can always add more.)

That said, someone who is good at using a level editor will save you money because they are 3-10x more efficient at using it than your average game designer.

### **Writers**

This is another job I often have. Unless your game is very long or needs to be made/revised *very* quickly, you probably don’t need two writers. If the first one isn’t sufficient, you should probably just replace them.

That said, there are sometimes cases where one writer is very good at things like story structure (which is vital in preproduction), but bad at writing scenes. In this case, you should employ that person until it’s time to start writing scenes, then bring in someone else to write dialogue. Keep the first writer in the loop if a plot/structure problem emerges later.

When picking a writer, you should look for someone with RPG experience. Writers from other genres don’t cross over very well, in my experience. That said, Western RPG writers can usually handle the crossover to JRPGs if they’re given a clear vision.

### **Producers**

This document is about smaller productions. If you have 25 or fewer people on the team, you probably only need one person doing scheduling and managing assignments. Maybe that’s you, if you have 20+ hours a week to dedicate to it. But if you don’t have that kind of time, hire a producer. They’ll keep the project moving forward, and let you know when the team needs specific aspects of the vision from you.

### **Music**

**Composer** – JRPGs will flop if they have bad, genre-inappropriate music. Most composers don’t have the schedule to work for an indie, full-time. Therefore, picking a composer early and having him or her make tracks for you, piecemeal, is the safest option.

 

# **Appendix 1: Toxic Brainstorming**

There are two times when making your game will definitely feel fun. The first month, and the day you release.

The first month (or maybe first 1-3 months) will be fun because you and your high-level hires will be *brainstorming*. This is incredibly fun. It feels great to have a bunch of ideas, kick them back and forth, and talk about what would be cool in a JRPG. It will never be more fun than this.

I’ll paraphrase a quote from Jeff Kaplan, who was a lead designer on World of Warcraft and Overwatch. He says something to the effect of “Your game is at its best when you haven’t made any of it. The more you make of your game, the worse it will get.” The point of this quote is not that making a good game is impossible. The point is that thinking about the possibilities of your game is fun; actually making your game only eliminates possibilities. Suddenly, your game is just one thing. It’s not all the other cool things it *could* have been. But there’s no other path forward.

Don’t get addicted to brainstorming. Brainstorming is like potassium in your diet. You need potassium\! But if you have too much potassium, you will get sick and possibly die. The same is true for brainstorming and your game. Brainstorming is important for your game\! But you can’t keep doing it forever; your game will get sick and die. Your contractors will see that your game is never going to come out. (Believe me, they’ll know before you do.) They’ll all switch over to survival mode and only work on your game for the sake of money. They’ll stop giving you advice, and most of them will even stop brainstorming with you. What’s the point? None of those ideas are ever going to get finished.

Brainstorming should be done when your documentation is done. The remaining 20% of the vision that is discovered through iteration--but that’s not brainstorming. That’s a specific set of problems in need of emergent solutions. Don’t let brainstorming seduce you, if you ever want your game to come out.

# **Appendix 2: So You’re Pivoting from Business to Videogames**

# **HEADNOTE: Are you dyslexic? Lots of entrepreneurs are dyslexic. (This is a scientific fact; there are studies on it\!) If you are a dyslexic creator, don’t read this section. Let someone read it to you. I recommend read-aloud dot com.**

This last section is for a certain type of first-time creator. Let’s say that you’ve been successful in the business world, and with that success you want to turn and make a videogame for the first time. Now, maybe you come from an art business. Did you make your fortune in TV, movies, books, theater, music or radio? In that case, you probably already know most of what I’m going to tell you.

But if you are pivoting from something like finance, B2B sales, real estate or a retail business, there are certain things you need to understand about the transition to games. Up until now, a large part of your job has been as a salesman. Your job, and your skill, has been getting people to say “yes.” Yes, I will buy your product. Yes, I will sign that contract. Yes, I will upgrade to premium. Yes, I will invest in your startup.

You must be very good at getting people to say yes, if you’ve made enough money to consider making a game on the side. Maybe you’ve convinced a publisher to say yes to a game you’ve pitched them. But now that it’s time to actually *make* the game, you need to adjust your mindset. You’re going to go a very long time between yesses. Your game doesn’t have dozens of investors that you need to persuade. It doesn’t have pieces you can pre-sell. It doesn’t have five levels of tech demo that you can show the public. You cannot get that “yes,” until the game is done. (Unless you have a publisher, then you need “yes” on your milestones. But everything I’m about to say still applies.)

You will feel an urge to change things in the game. A few people on social media will see a screenshot and won’t like it. You will feel the immediate, overwhelming urge to change your product so that they will say yes. Getting people to say yes is your skill\! It’s your vocation in life\! But doing this will destroy your project. Time and again I have seen creators constantly change the product to get a short-term “yes.” Every time you do this, the project slows down and increases in cost. And what’s the point? You don’t earn any money from yesses on social media. Adoration on social media, coverage in game news outlets, even Steam wishlists—those people aren’t saying yes. They’re saying “maybe\!”

People can only say yes to a finished game. If you insist on getting a “maybe” from everyone who sees your unfinished product, you will never finish the game. If you are going crazy from a lack of yesses, don’t order your team to make changes to your game. Find another outlet for your energy. Making the game isn’t exciting. After the first month or so, you’ll realize that making a game is *work*. The more boring your production is, the faster and cheaper your production will be.

Once you have large, playable sections of the game, then you can ask playtesters to say yes. Some of them will say “no.” But you need to be very careful with your salesmen instincts. If you have 35 playtesters and four tell you no, that’s as good a result as you are ever going to get. Getting those four people to say yes will be expensive, and you’ll probably flip another four people to “no,” in the process. If 15 out of 35 people say no, *then* you have a real problem and something needs to change. In that case, check to see what those 15 people said in their feedback. Isolate the things they all agreed on. Make small changes to those features until the metrics improve.

Hang in there. Ultimately, the only important “yes” is the purchase button.

# 

 

