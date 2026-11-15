(function (root) {
  var WORDS = {
    Food: ["pizza","chocolate","sandwich","biryani","mango","noodles","dosa","samosa","burger","pasta","popcorn","pancake","curry","sushi","salad","coffee","cheese","banana","watermelon","icecream"],
    Animal: ["elephant","tiger","peacock","dolphin","camel","penguin","giraffe","monkey","parrot","crocodile","kangaroo","owl","butterfly","shark","horse","rabbit","lion","snake","eagle","octopus"],
    Place: ["library","airport","castle","hospital","lighthouse","stadium","temple","museum","beach","market","school","zoo","cinema","bridge","farm","station","mall","bakery","cave","island"],
    Object: ["guitar","umbrella","mirror","telescope","backpack","microphone","scissors","candle","clock","bottle","helmet","camera","lantern","wallet","pencil","bucket","ladder","blanket","kettle","compass"],
    Vehicle: ["submarine","bicycle","helicopter","train","tractor","rocket","bus","scooter","ambulance","ship","airplane","rickshaw","truck","canoe","skateboard","ferry","jeep","tram","balloon","taxi"],
    Nature: ["volcano","monsoon","desert","rainbow","waterfall","glacier","forest","thunder","river","mountain","ocean","storm","sunrise","lake","jungle","earthquake","snowflake","moon","cloud","tornado"],
    Sport: ["cricket","football","badminton","chess","swimming","kabaddi","tennis","hockey","boxing","cycling","archery","volleyball","yoga","basketball","wrestling","golf","skating","surfing","running","carrom"],
    Event: ["wedding","festival","birthday","concert","exam","picnic","diwali","graduation","parade","reunion","interview","fireworks","holiday","party","marathon","carnival","anniversary","trip","sale","drama"],
    Job: ["doctor","teacher","pilot","farmer","chef","police","firefighter","artist","singer","engineer","driver","tailor","scientist","actor","judge","barber","dentist","plumber","astronaut","soldier"],
    Clothing: ["shirt","jeans","saree","sandals","jacket","scarf","turban","sweater","socks","gloves","cap","uniform","raincoat","belt","tie","shorts","necklace","boots","hoodie","glasses"],
    Home: ["sofa","bed","fan","fridge","stove","window","curtain","pillow","toothbrush","shower","television","kitchen","balcony","doorbell","bookshelf","table","lamp","broom","mattress","staircase"],
    Tech: ["phone","laptop","charger","headphones","wifi","robot","drone","satellite","password","emoji","selfie","website","battery","screen","printer","keyboard","router","speaker","calculator","game"],
    Fantasy: ["dragon","ghost","pirate","wizard","mermaid","vampire","superhero","alien","treasure","unicorn","zombie","genie","detective","magic","spaceship","monster","fairy","robot-dog","giant","time-machine"]
  };
  if (typeof module !== "undefined" && module.exports) module.exports = WORDS; else root.WORDS = WORDS;
})(this);
