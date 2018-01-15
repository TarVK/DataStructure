var DataStructure = (function(){
    /*
        full example structure of type:
        {
            name: "Field Name",              //name of field if field of object
            type: "object",                  //type of variable (either string or clas)
            fields: [type],                  //the fields that an object should have if the type is object (recursive structure)
            childType: type,                 //the type that any field not defined in fields may have (recursive structure)
            default: {},                     //the default value if the value is left out
            validate: function(val, path){}, //a validation function that should return an error string if val is invalid
            init: function(val, path){}      //a function to initialise allowed data to a single type if needed
        }
    */
    var scanSymbol = Symbol("scan");
    var CustomError = function(text){
        this.text = text;
    };
    var DataStructure = function(type, parentType){
        this.type = type;
    };
    var pt = DataStructure.prototype;
    pt.validate = function(data, initContext, type, dontInitBaseObj){
        var structureMatch = this.matchStructure(data, type);
        if(structureMatch.misMatches){
            //method to remove count number from mismatches and get the text from custom errors
            var cleanError = function(obj){
                if(obj instanceof CustomError) return obj.text; //extract the text from the custom error
                delete obj.misMatchCount; //remove number
                
                var keys = Object.keys(obj); //get children of object
                for(var i=0; i<keys.length; i++){
                    var key = keys[i];
                    var val = obj[key];
                    if(val instanceof Object) //if child is an object, remove numbers from that
                        obj[key] = cleanError(val);
                }
                return obj;
            };
            
            //remove count numbers from mismatches and get message from custom errors
            var misMatches = structureMatch.misMatches;
            misMatches = cleanError(misMatches);

            if(typeof(misMatches)=="string") //if the message is simply a string, throw this dirrectly
                throw Error("argument "+misMatches);
            
            //create nicely formatted json object, without quotes around keys
            var errorObjText = JSON.stringify(misMatches, null, 2);
            errorObjText.replace(/\\"/g,"\uFFFF"); //U+ FFFF
            errorObjText = errorObjText.replace(/\"([^"]+)\":/g,"$1:").replace(/\uFFFF/g,"\\\"");
            
            //throw the created error
            throw Error("the given data doesn't match the required type, difference with the most similar structure:\n"+
                        errorObjText);
        }else{
            var init = structureMatch.init;
            if(init){
                var initObj = function(obj, init, path, dontInit){
                    var keys = Object.keys(init); //get all fields to initialise 
                    for(var i=0; i<keys.length; i++){
                        var key = keys[i];
                        var initVal = init[key];
                        
                        if(initVal instanceof Object && obj[key]!==undefined){ //if field is of type object, go through all its fields
                            obj[key] = initObj(obj[key], initVal, path?path+"."+key:key);
                        }else{ //else initialise the value directly
                            obj[key] = initVal;
                        }
                    }
                    
                    if(init instanceof Function && !dontInit) //apply the init function if defined
                        return init.call(initContext, obj, path);
                    return obj;
                };
                data = initObj(data, init, "self", dontInitBaseObj);
            }
            return data;
        }
    };
    var copyStructure = function(obj, type){
        var keys = Object.keys(type);
        for(var i=0; i<keys.length; i++){
            var key = keys[i];
            if(key!="type"){
                obj[key] = type[key];
            }
        }
    };
    pt.matchStructure = function(data, type, path){
        if(!type) type = this.type;
        if(!path) path = "root";
        
        if(type.type){ //if type is an object with data like: name, type, fields, default, validate, childType
            var structureMatch = this.matchStructure(data, type.type, path); //match type
            copyStructure(structureMatch.structure, type); //copy all the structure of type into structure
            if(type.default!==undefined && data==undefined){  //if a default value is defined, indicate that this should be instantiated
                delete structureMatch.misMatches;
                structureMatch.init = type.default;
            }
            if(!structureMatch.misMatches && type.validate){ //if data is still valid, check the validate function if provided
                var result = type.validate.call(data, data, path);
                if(result) structureMatch.misMatches = new CustomError(result); //set the mismatch message if provided
            } 
            if(structureMatch.misMatches || structureMatch.init!==undefined) return structureMatch; //if the structure is invalid at this point, or we know it must be initialised to the defualt value, return the structure data
            
            //if the structure is still valid, check if the child structure is also valid
            if(typeof(data)=="object" && type.type && (type.type.__proto__==Object.prototype || typeof(type.type)=="string")){
                structureMatch.structure.fields = {}; //the fields to store the child structure in
            
                var misMatchObj = {}; //the object to store the child mismatches in (we already know that this data itself doesn't mismatch)
                var misMatchCount = 0; //the number of mismatches, as it is of importance for choosing what structure is most similar
                var initObj = {}; //the object to store initialisation 
                var fieldsLeftToTest = Object.keys(data); //the fields of which the type must be test
                
                //the function to test a specific field and store its result as a part of this field
                var This = this;
                var scanField = function(field, fieldValue, fieldName){
                    if(fieldValue instanceof Object && fieldValue[scanSymbol]!==undefined)
                        return;
                        
                    //check the specific field's structure
                    var childStructureMatch = This.matchStructure(fieldValue, field, path+"."+(fieldName||field.name));
                    if(childStructureMatch.misMatches){ //if there are mismatches, store these
                        var misMatches = childStructureMatch.misMatches;
                        misMatchObj[fieldName||field.name] = misMatches;
                        
                        //increase the mismatch count
                        if(misMatches.misMatchCount==null) misMatchCount += 1;
                        else misMatchCount += misMatches.misMatchCount;
                    }
                    if(childStructureMatch.init){ //if there are fields to initialise, store these
                        initObj[fieldName||field.name] = childStructureMatch.init;
                    }
                    //store the structure itself
                    structureMatch.structure.fields[field.name] = childStructureMatch.structure;
                };
                
                data[scanSymbol] = true;
                //test specific fields if defined
                if(type.fields){
                    for(var i=0; i<type.fields.length; i++){
                        var field = type.fields[i];
                        var fieldValue = data[field.name];
                        
                        //check the actual field
                        scanField(field, fieldValue);
                        
                        //remove field from the fields that are left to check
                        var fieldIndex = fieldsLeftToTest.indexOf(field.name);
                        if(fieldIndex>=0) fieldsLeftToTest.splice(fieldIndex, 1);
                    }
                }
                //test any remainingFields
                for(var i=0; i<fieldsLeftToTest.length; i++){
                    var name = fieldsLeftToTest[i];
                    var fieldValue = data[name];
                
                    if(type.childType){
                        //check the actual field
                        scanField(type.childType, fieldValue, name);
                    }else{
                        misMatchObj[name] = "this field is not allowed";
                        misMatchCount += 1;
                    }
                }
                delete data[scanSymbol];
                
                //only add mistMatch and init fields to result if needed
                if(misMatchCount>0){
                    misMatchObj.misMatchCount = misMatchCount;
                    structureMatch.misMatches = misMatchObj;
                }
                if(Object.keys(initObj).length>0){
                    structureMatch.init = initObj;
                }
            }
            if(type.init){
                var orInit = structureMatch.init;
                //deep copy init function
                structureMatch.init = function(){return type.init.apply(this, arguments);};
                
                //copy fields of original init object
                if(orInit){
                    var keys = Object.keys(orInit);
                    for(var i=0; i<keys.length; i++){
                        var key = keys[i];
                        structureMatch.init[key] = orInit[key];
                    }
                }
            }
            return structureMatch;
        }else if(type instanceof Array){ //go through all accepted types for this field
            var closestMatch; //the match that is most similar
            var closestMatchType; //the type/structure of the match that is most similar
            var types = type; //the list of types to check
            //go through all types to check how similar they are
            for(var i=0; i<types.length; i++){
                type = types[i];
                
                //check the structure
                var structureMatch = this.matchStructure(data, type, path);
                var misMatches = structureMatch.misMatches;
                if(!misMatches) return structureMatch; //accept the result if there are no misMatches
                
                if(misMatches instanceof Object) //if the misMatches are child misMatches, store the most similar type
                    if(!closestMatch||misMatches.misMatchCount<closestMatch.misMatches.misMatchCount){
                        closestMatch = structureMatch;
                        closestMatchType = type;
                    }
            }
            
            if(!closestMatch){ //if no type was matched, create a message with available types
                var typeList = []; //the list of available types
                for(var i=0; i<types.length; i++){
                    var type = types[i];
                    
                    //get the actual type value (might be type itself, might be stored in a type field if part of an object
                    var t; 
                    if(type.type) t = type.type;
                    else t = type;
                    
                    //only add to available types if not already in there
                    if(typeList.indexOf(t)==-1){
                        if(t.name) t = t.name;
                        typeList.push(t);   
                    }
                }
                //create a structure object that contains all the available types as no specific type was matched
                closestMatch = {structure:{type:typeList}};
                
                //create a misMatch message based on the available types
                if(typeList.length>1)
                    closestMatch.misMatches = "should be one of types: "+typeList.join(", ");
                else
                    closestMatch.misMatches = "should be of type "+typeList[0];
            }
            
            return closestMatch;
        }else{ //check if this field corresponds with the accepted type
            var ret = {structure:{type:type}};
            
            if(type=="*") return ret; //accept anything if type is *
            if(type=="array") type=Array; //typeof() never returns "array"
            
            var sameType;
            if(typeof(type)=="string")
                sameType = typeof(data)==type.toLowerCase(); //if a string was defined, check if it was of said type
            else
                sameType = data instanceof type; //if a class was defined, check if it is an instance of said class
                
            //if the type doesn't match, create a message saying so
            if(!sameType) ret.misMatches = "should be of type "+(type==Array?"Array":(type.name?type.name:type));
            return ret;
        }
    };
    DataStructure.getMisMatchErrorMessage = pt.getMisMatchErrorMessage;
    DataStructure.getMisMatches = pt.getMisMatches;
    return DataStructure;
})();
