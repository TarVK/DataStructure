# DataStructure
A class to verify whether a given variable conforms to the required structure.
This can be used in libraries to make sure users are inputting the required type, and get feedback if they are not.

## Usage
### Initialisation
The DataStructure class should be initialised with an object as the first and only argument.
This object will be the structure object that will be used to validate other variables.
The following fields are allowed:
Field Name | Type | Description
---------- | ---- | -----------
name | "Field Name" | Name of field if field of object
type | structure | Type of variable (string, class or structure), may also be an array of options.
fields | \[structure] | The fields that an object should have if the type is object (recursive structure)
childType | structure | The type that any field not defined in fields may have (recursive structure)
default | {} | The default value if the value is left out
validate | function(val, path){} | A validation function that should return an error string if val is invalid
init | function(val, path){} | A function to transform the received data to a other type
In this table, the word structure represents an object containing the contents of the table itself, or a string or class specifying a simple variable type.

Example:
```js
var ds = new DataStructure({
	type: "object",
	fields: [{
		name: "someNumber",
		type: "number"        
	},{
		name: "someString",
		type: "string"
	}]
});
```
### Validation
Once a DataStructure object has been created, the validate method can be called in order to check whether a variable conforms to the specified type. If it doesn't an error with feedback will be thrown.

Example:
```js
var data = {
	someNumber: 3, 
	someString: "text"
};
ds.validate(data);
```
### Checking Structure
If you want to check whether an object conforms to the specified type without throwing an error if it doesn't, the matchStructure method can be used. This will return data about the match. This data will contain the structure of the object, misMatches if the data didn't conform to the specified type and init if there are fields to initialise in order to conform to the type. The structure  field will mainly be useful when the specified type has multiple options and branches.

Example:
```js
var data = {
	someNumber: 3, 
	someString: 3
};
var structure = ds.matchStructure(data);
/*
	the structure variable will look like this:
	{
		structure: {
			type: "object",
			fields: {
				someNumber: {
					type: "number",
					name: "someNumber"
				},
				someString: {
					type: "string",
					name: "someString"
				}
			}
		},
		misMatches: {
			someString: "should be of type string",
			misMatchCount: 1
		}
	}
*/
```

## Examples
### Options
```js
//setup
var ds = new DataStructure({
	type: "object",
	fields: [{
		name: "test",
		type: ["number", "string"]
	},{
		name: "obj",
		type: [{
			type: "object",
			fields: [{
				name: "text",
				type: "string"
			}],
			childType: "number"
		},{
			type: "object",
			fields: [{
				name: "bool",
				type: "boolean"
			}]
		}]
	}]
});

//validation examples
ds.validate({
	test: 3,
	obj: {
		text: "text",
		someRandomFieldName: 3
    }
});
ds.validate({
	test: "text",
	obj: {
		bool: true
    }
});
ds.validate({
	test: true,
	obj: {
		bool: false,
		someRandomFieldName: 6
    }
});
```
All but the last validations will pass. The last validation will throw the following error:
![Structure feedback](Error%20images/DataStrucure%20error%201 "Structure feedback")

### Recursive Array Of Numbers
```js
//setup
var type = {
	type: "array",
	childType: ["number"]
};
type.childType.push(type);
var ds = new DataStructure(type);

//validation examples
ds.validate([1,2,3,[4,5,[6,7],8],[9]]);
ds.validate([1,2,3,[4,5,[6,"7"],8],[9]]);
```
Only the last validation won't pass, it will throw the following error:
![Structure feedback](Error%20images/DataStrucure%20error%202 "Structure feedback")
### N-dimensional Matrix
```js
var sizeArray = []; //an array to store the dimension sizes of an matrix being scanned
var type = {
	type: "array",
	childType: ["number"],
	validate: function(data, path){
		var dim = path.split(".").length-1; //extract the dimension from the path
		if(sizeArray[dim]==null){ //initialise the dimension size
			sizeArray[dim] = data.length;
        }else if(sizeArray[dim]!=data.length){ //verify the dimension size
			return "Should be of size "+sizeArray[dim];
        }
    }
};
type.childType.push(type);
var ds = new DataStructure(type);

var validateMatrix = function(data){
	sizeArray = []; //reset the dimension size array
	ds.validate(data);
}

//validation examples
validateMatrix([[1,2,3],
				[1,2,3],
				[1,2,3]]); //2 dimensional matrix
validateMatrix([[[1,2,3],
				 [1,2,3],
				 [1,2,3]],
				[[1,2,3],
				 [1,2,3],
				 [1,2,3]]]); //3 dimensional matrix
validateMatrix([[[1,2,3],
				 [1,2,3],
				 [1,2,3]],
				[[1,2,3],
				 [1,2],
				 [1,2,3]]]); //3 malformed dimensional matrix
```
All but the last validations will pass. The last validation will throw the following error:
![Structure feedback](Error%20images/DataStrucure%20error%203 "Structure feedback")

### Infinite Recursion
DataStructure can also handle objects that contain infinite recursion without problems.
```js
//setup
var type = {
	type: "array",
	childType: ["number"]
};
type.childType.push(type);
var ds = new DataStructure(type);

//validation examples
var data = [[1,2],3,4,5];
data[0].push(data);
ds.validate(data);

var data = [[1,2,"test"],3,4,5];
data[0].push(data);
ds.validate(data);
```
Only the last validation won't pass, it will throw the following error:
![Structure feedback](Error%20images/DataStrucure%20error%204 "Structure feedback")
### Default Values
```js
//setup
var ds = new DataStructure({
	type: "object",
    fields: [{
		name: "required",
		type: "number"
	},{
		name: "nonRequired",
		type: "number",
        default: 5
    }]
});

//validation example
var result = ds.validate({
	required: 4
});
/*
	the result variable will now look like this:
    {
		nonRequired: 5,
		required: 4
    }
*/
```
### Initialisation
```js
//setup
var dsNumber = new DataStructure({
	type: "number",
	init: function(data, field){
		return data+1;
    }
});
var dsObject = new DataStructure({
	type: "object",
	fields: [{
		name: "val",
		type: "number",
		init: function(data, field){
            return data+1;
        }
	}]	
});

//validation example
var number = dsNumber.validate(5);
var object = dsObject.validate({val:5});
/*
	the number variable will now have the value 6,
    the object variable will now look like this:
    {
		val: 6
    }
*/
```
### Type Conversion Using Initialisation
```js
//setup
var ds = new DataStructure({
	type: [{
		type: "number",
		validate: function(data){
			if(data!=0 && data!=1) return "should be either 0 or 1";
		}
	}, "boolean"],
	init: function(data){
		if(typeof(data)=="number") return data==1;
		return data;
    }
});

//validation example
var bool1 = ds.validate(0);
var bool2 = ds.validate(true);
var bool3 = ds.validate(5);
/*
	the bool1 variable will now have the value false,
    the bool2 variable will now have the value true
*/
```
All but the last validations will pass. The last validation will throw the following error:
![Structure feedback](Error%20images/DataStrucure%20error%205 "Structure feedback")
### Class types
```js
//setup
var SomeClass = function(someData){
	this.data = someData;
};
var ds = new DataStructure({
	type: "object",
	fields: [{
		name: "field",
		type: SomeClass
	}]
});

//validation example
ds.validate({field: new SomeClass(3)});
ds.validate({field: 3});
```
Only the last validation won't pass, it will throw the following error:
![Structure feedback](Error%20images/DataStrucure%20error%206 "Structure feedback")
