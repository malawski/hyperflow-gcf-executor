var projectId = process.env.GCLOUD_PROJECT; // E.g. 'grape-spaceship-123' 

var spawn = require('child_process').spawn;
var gcloud = require('gcloud');
var async = require('async');



exports.hyperflow_executor = function (req, res) {

  var executable = req.body.executable;
  var args = req.body.args;
  var inputs = req.body.inputs;
  var outputs = req.body.outputs;
  var bucket_name = req.body.options.bucket;
  var prefix = req.body.options.prefix


  console.log('executable: ' + executable);
  console.log('args:       ' + args);
  console.log('inputs:     ' + inputs);
  console.log('inputs[0].name:     ' + inputs[0].name);
  console.log('outputs:    ' + outputs);
  console.log('bucket:     ' + bucket_name);
  console.log('prefix:     ' + prefix);


var gcs = gcloud.storage({
  projectId: projectId
});

function download(callback) {

  async.each(inputs, function (file_name, callback) {

    file_name = file_name.name
    var full_path = bucket_name + "/" +  prefix + "/" + file_name
    console.log('downloading ' + full_path);


    // Reference an existing bucket. 
    var bucket = gcs.bucket(bucket_name + "/" +  prefix );
 
    // Download a file from your bucket. 
    bucket.file(file_name).download({
      destination: file_name
    }, function(err) {
      if( err ) {
        console.log("Error downloading file " + full_path);
	callback(err);
      } else {
        console.log("Downloaded file " + full_path);
        callback();
      }
    });
    }, function(err){
      if( err ) {
        console.log('A file failed to process');
        callback('Error downloading')
      } else {
        console.log('All files have been downloaded successfully');
        callback()
      }
  });
}


function execute(callback) {
  var proc_name = __dirname + '/' + executable // use __dirname so we don't need to set env[PATH] and pass env 

  console.log('spawning ' + proc_name);
  process.env.PATH = '.'; // add . to PATH since e.g. in Montage mDiffFit calls external executables
  var proc = spawn(proc_name, args);

  proc.on('error', function (code) {
        console.log('error!!'  + executable + JSON.stringify(code));
//	callback(JSON.stringify(code))
    });

  proc.stdout.on('data', function (exedata) {
        console.log('Stdout: ' + executable + exedata);
    });

  proc.stderr.on('data', function (exedata) {
         console.log('Stderr: ' + executable + exedata);
     });

  proc.on('close', function (code) {
         console.log('My GCF exe close'  + executable);
         callback()
    });

  proc.on('exit', function (code) {
         console.log('My GCF exe exit' + executable);
       });

}

function upload(callback) {

  async.each(outputs, function (file_name, callback) {

    file_name = file_name.name

    var full_path = bucket_name + "/" +  prefix + "/" + file_name
    console.log('uploading ' + full_path);

    // Reference an existing bucket. 
    var bucket = gcs.bucket(bucket_name );
 
    // Upload a file to your bucket. 
    bucket.upload(__dirname + '/' + file_name, {destination:  prefix + "/" + file_name}, function(err) {
      if( err ) {
        console.log("Error uploading file " + full_path);
        console.log(err);
	callback(err);
      } else {
        console.log("Uploaded file " + full_path);
        callback();
      }
    });
}, function(err){
      if( err ) {
        console.log('A file failed to process');
        callback('Error uploading')
      } else {
        console.log('All files have been uploaded successfully');
        callback()
      }
  });
}


async.waterfall([
  download,
  execute,
  upload
], function (err, result) {
      if( err ) {
        console.log('Error: ' + err);
        res.status(400).send('Bad Request ' + JSON.stringify(code));
      } else {
        console.log('Success');
        res.send('My GCF Function exit: ' + executable + args);    
      }
})

};
